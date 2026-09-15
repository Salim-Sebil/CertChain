const mongoose = require("mongoose");

/** Table 4.1 — Students collection. */
const studentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentNumber: { type: String, required: true, unique: true, trim: true },
    programme: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    graduationYear: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
