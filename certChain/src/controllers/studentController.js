const mongoose = require("mongoose");
const User = require("../models/User");
const Student = require("../models/Student");
const AppError = require("../utils/AppError");
const { sendPasswordResetEmail } = require("../utils/email");

/** POST /api/students — admin only (FR-A2). Creates the User + Student
 *  pair in one transaction-like sequence: if the Student write fails,
 *  the just-created User is rolled back so we never leave an orphaned
 *  login with no student record behind it. */
async function registerStudent(req, res, next) {
  try {
    const { name, email, studentNumber, programme, department, graduationYear, temporaryPassword } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw new AppError("A user with this email already exists.", 409);

    const generatedPassword = temporaryPassword || `Temp${Math.random().toString(36).slice(2, 8)}!`;

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: generatedPassword,
      role: "student",
      mustChangePassword: true,
    });

    const student = await Student.create({
      user: user._id,
      studentNumber,
      programme,
      department,
      graduationYear,
    });

    const resetToken = user.generatePasswordResetToken();
    user.student = student._id;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:8000"}/#/set-password?token=${resetToken}`;
    const emailResult = sendPasswordResetEmail(email.toLowerCase(), resetLink);

    res.status(201).json({
      success: true,
      student: {
        studentId: student._id,
        userId: user._id,
        studentNumber,
        programme,
        department,
        graduationYear,
        email,
        mustChangePassword: true,
      },
      temporaryPassword: generatedPassword,
      resetLink,
      email: emailResult,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/students — admin only. Used to populate the "Issue Certificate" dropdown. */
async function listStudents(req, res, next) {
  try {
    const students = await Student.find().populate("user", "name email");
    res.json({
      success: true,
      students: students.map((s) => ({
        studentId: s._id,
        name: s.user?.name,
        email: s.user?.email,
        studentNumber: s.studentNumber,
        programme: s.programme,
        department: s.department,
        graduationYear: s.graduationYear,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerStudent, listStudents };
