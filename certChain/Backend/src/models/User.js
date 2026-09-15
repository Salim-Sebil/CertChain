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

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    userId: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    studentId: this.student || null,
  };
};

module.exports = mongoose.model("User", userSchema);
