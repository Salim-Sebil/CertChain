const Certificate = require("../models/Certificate");
const Student = require("../models/Student");
const VerificationLog = require("../models/VerificationLog");

/** GET /api/reports/summary — admin only (FR-A8). */
async function getSummary(req, res, next) {
  try {
    const [totalCertificates, totalRevoked, totalStudents, totalVerifications, certificates] = await Promise.all([
      Certificate.countDocuments(),
      Certificate.countDocuments({ status: "revoked" }),
      Student.countDocuments(),
      VerificationLog.countDocuments(),
      Certificate.find().select("student"),
    ]);

    const studentIds = certificates.map((c) => c.student);
    const students = await Student.find({ _id: { $in: studentIds } }).select("programme");
    const programmeById = new Map(students.map((s) => [s._id.toString(), s.programme]));

    const byProgramme = {};
    certificates.forEach((c) => {
      const programme = programmeById.get(c.student.toString()) || "Unclassified";
      byProgramme[programme] = (byProgramme[programme] || 0) + 1;
    });

    res.json({
      success: true,
      totalCertificates,
      totalRevoked,
      totalStudents,
      totalVerifications,
      byProgramme,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary };
