const mongoose = require("mongoose");

/** Table 4.1 — Certificates collection. */
const certificateSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    certificateNumber: { type: String, required: true, unique: true, index: true, trim: true },
    degree: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    hash: { type: String, required: true }, // SHA-256 hex digest, Section 4.4.6
    qrCode: { type: String, required: true }, // data URL, generated server-side (Section 4.4.6)
    status: { type: String, enum: ["valid", "revoked"], default: "valid" },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);
