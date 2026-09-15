const QRCode = require("qrcode");

/** Section 4.4.6 — QR codes encode a verification URL containing the
 *  certificate number, so scanning one takes a verifier straight to
 *  the verification result for that certificate. */
function buildVerificationUrl(certificateNumber) {
  const base = process.env.FRONTEND_URL || "http://localhost:8080";
  return `${base}/#/verify?cert=${encodeURIComponent(certificateNumber)}`;
}

async function generateQrDataUrl(certificateNumber) {
  const url = buildVerificationUrl(certificateNumber);
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 256 });
}

module.exports = { buildVerificationUrl, generateQrDataUrl };
