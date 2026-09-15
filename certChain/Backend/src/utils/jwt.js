const jwt = require("jsonwebtoken");

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, studentId: user.student ? user.student.toString() : null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

module.exports = { signToken };
