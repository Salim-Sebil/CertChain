const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/** Table 4.1 — Users collection.
 *  Only Administrator and Student roles authenticate through this model;
 *  the Employer/Verifier actor never logs in (Section 4.3.6 / use case
 *  diagram), so "verifier" is deliberately not a role here. */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "student"], required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    mustChangePassword: { type: Boolean, default: false },
    passwordResetToken: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.setPassword = async function setPassword(newPassword) {
  if (!newPassword || newPassword.trim().length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  this.password = newPassword;
  this.passwordResetToken = null;
  this.passwordResetExpiresAt = null;
  await this.save();
};

userSchema.methods.generatePasswordResetToken = function generatePasswordResetToken() {
  const crypto = require("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = token;
  this.passwordResetExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return token;
};

userSchema.methods.clearPasswordResetToken = function clearPasswordResetToken() {
  this.passwordResetToken = null;
  this.passwordResetExpiresAt = null;
};

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    userId: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    studentId: this.student || null,
    mustChangePassword: !!this.mustChangePassword,
  };
};

module.exports = mongoose.model("User", userSchema);
