const crypto = require("crypto");

/** Canonical hash of record for a certificate — Section 4.4.6.
 *  Uses Node's built-in crypto module (not a third-party package),
 *  exactly as specified. The canonical string intentionally includes
 *  the certificate's own id and number so that two certificates with
 *  otherwise-identical content never collide. */
function buildCanonicalString({ certificateId, studentId, certificateNumber, degree, issueDate }) {
  const isoDate = issueDate instanceof Date ? issueDate.toISOString().slice(0, 10) : String(issueDate);
  return [certificateId, studentId, certificateNumber, degree, isoDate].join("|");
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function generateCertificateHash(fields) {
  return sha256Hex(buildCanonicalString(fields));
}

module.exports = { buildCanonicalString, sha256Hex, generateCertificateHash };
