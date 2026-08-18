const mongoose = require("mongoose");

/** Table 4.1 — VerificationLogs collection. Every verification attempt is
 *  recorded here, including ones that don't match a certificate at all,
 *  per the Reporting & Logging process (Section 4.2.2, process 4.0). */
const verificationLogSchema = new mongoose.Schema(
  {
    certificate: { type: mongoose.Schema.Types.ObjectId, ref: "Certificate", default: null },
    verifier: { type: String, default: "Public verifier" }, // requester IP or identifier
    status: { type: String, enum: ["valid", "revoked", "not_found"], required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model("VerificationLog", verificationLogSchema);
