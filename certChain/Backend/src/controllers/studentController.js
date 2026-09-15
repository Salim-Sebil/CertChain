const mongoose = require("mongoose");
const User = require("../models/User");
const Student = require("../models/Student");
const AppError = require("../utils/AppError");

/** POST /api/students — admin only (FR-A2). Creates the User + Student
 *  pair in one transaction-like sequence: if the Student write fails,
 *  the just-created User is rolled back so we never leave an orphaned
 *  login with no student record behind it. */
async function registerStudent(req, res, next) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { name, email, studentNumber, programme, department, graduationYear, temporaryPassword } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() }).session(session);
    if (existing) throw new AppError("A user with this email already exists.", 409);

    const [user] = await User.create(
      [{ name, email: email.toLowerCase(), password: temporaryPassword || "changeme123", role: "student" }],
      { session }
    );

    const [student] = await Student.create(
      [{ user: user._id, studentNumber, programme, department, graduationYear }],
      { session }
    );

    user.student = student._id;
    await user.save({ session });

    await session.commitTransaction();
    res.status(201).json({
      success: true,
      student: { studentId: student._id, userId: user._id, studentNumber, programme, department, graduationYear },
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
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
