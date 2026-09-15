const Certificate = require("../models/Certificate");
const Student = require("../models/Student");
const VerificationLog = require("../models/VerificationLog");
const BlockchainTransaction = require("../models/BlockchainTransaction");
const AppError = require("../utils/AppError");
const { generateCertificateHash } = require("../utils/hash");
const { issueCertificateOnChain } = require("../utils/blockchain");
const { generateQrDataUrl } = require("../utils/qr");

function generateCertificateNumber(issueDate) {
  const year = new Date(issueDate).getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SVU-${year}-${suffix}`;
}

/** POST /api/certificates/issue — admin only (FR-A3, FR-A4, FR-A5).
 *  Implements the sequence in Section 4.3.3: validate → hash → register
 *  on-chain → persist certificate + transaction → generate QR. */
async function issueCertificate(req, res, next) {
  try {
    const { studentId, degree, issueDate } = req.body;

    const student = await Student.findById(studentId);
    if (!student) throw new AppError("Selected student was not found.", 404);

    const certificateNumber = generateCertificateNumber(issueDate);

    // certificateId is allocated up front (not yet saved) so it can be
    // included in the canonical hash input, same as certificateNumber.
    const certificate = new Certificate({
      student: student._id,
      certificateNumber,
      degree,
      issueDate,
      hash: "pending",
      qrCode: "pending",
    });

    const hash = generateCertificateHash({
      certificateId: certificate._id.toString(),
      studentId: student._id.toString(),
      certificateNumber,
      degree,
      issueDate,
    });
    certificate.hash = hash;
    certificate.qrCode = await generateQrDataUrl(certificateNumber);

    const chainResult = await issueCertificateOnChain(hash, certificate._id.toString());

    await certificate.save();
    await BlockchainTransaction.create({
      certificate: certificate._id,
      txHash: chainResult.txHash,
      blockNumber: chainResult.blockNumber,
      contractAddress: chainResult.contractAddress,
      simulated: chainResult.simulated,
    });

    res.status(201).json({ success: true, certificate: serializeCertificate(certificate) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/certificates?studentId=... — admin sees all, a student can
 *  only ever request their own (enforced below), per FR-A6 / FR-S2. */
async function listCertificates(req, res, next) {
  try {
    const { studentId } = req.query;

    if (req.user.role === "student") {
      const own = req.user.student ? req.user.student.toString() : null;
      if (studentId && studentId !== own) {
        throw new AppError("You can only view your own certificates.", 403);
      }
    }

    const filter = {};
    if (studentId) filter.student = studentId;
    else if (req.user.role === "student") filter.student = req.user.student;

    const certificates = await Certificate.find(filter).sort({ issueDate: -1 });
    const transactions = await BlockchainTransaction.find({
      certificate: { $in: certificates.map(certificate => certificate._id) },
    });
    const transactionByCertificate = new Map(
      transactions.map(transaction => [transaction.certificate.toString(), serializeTransaction(transaction)])
    );

    res.json({
      success: true,
      certificates: certificates.map(certificate => ({
        ...serializeCertificate(certificate),
        transaction: transactionByCertificate.get(certificate._id.toString()) || null,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/certificates/:id */
async function getCertificate(req, res, next) {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) throw new AppError("Certificate not found.", 404);
    res.json({ success: true, certificate: serializeCertificate(certificate) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/certificates/verify — public, rate-limited (FR-V1..V4).
 *  Accepts either a certificateNumber (manual search / QR scan) or a
 *  raw hash (recomputed client-side from an uploaded document),
 *  matching the two verifier flows in Section 4.3.4. */
async function verifyCertificate(req, res, next) {
  try {
    const { certificateNumber, hash } = req.body;
    if (!certificateNumber && !hash) {
      throw new AppError("Provide a certificateNumber or a hash to verify.", 400);
    }

    const query = certificateNumber ? { certificateNumber: certificateNumber.trim() } : { hash };
    const certificate = await Certificate.findOne(query);

    const status = !certificate ? "not_found" : certificate.status === "revoked" ? "revoked" : "valid";

    await VerificationLog.create({
      certificate: certificate ? certificate._id : null,
      verifier: req.ip,
      status,
      date: new Date(),
    });

    if (!certificate) {
      return res.json({ success: true, result: "not_found" });
    }

    const student = await Student.findById(certificate.student).populate("user", "name");
    const transaction = await BlockchainTransaction.findOne({ certificate: certificate._id });

    res.json({
      success: true,
      result: status,
      certificate: serializeCertificate(certificate),
      studentName: student?.user?.name || "Unknown",
      transaction: transaction
        ? {
            txHash: transaction.txHash,
            blockNumber: transaction.blockNumber,
            contractAddress: transaction.contractAddress,
            simulated: transaction.simulated,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/certificates/:id/revoke — admin only (FR-A7). */
async function revokeCertificate(req, res, next) {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) throw new AppError("Certificate not found.", 404);
    if (certificate.status === "revoked") throw new AppError("Certificate is already revoked.", 409);

    certificate.status = "revoked";
    certificate.revokedAt = new Date();
    certificate.revokedReason = req.body.reason || null;
    await certificate.save();

    // Sprint 5: also call revokeCertificateOnChain(certificate.hash) here.

    res.json({ success: true, certificate: serializeCertificate(certificate) });
  } catch (err) {
    next(err);
  }
}

function serializeCertificate(c) {
  return {
    certificateId: c._id,
    studentId: c.student,
    certificateNumber: c.certificateNumber,
    degree: c.degree,
    issueDate: c.issueDate,
    hash: c.hash,
    qrCode: c.qrCode,
    status: c.status,
    revokedAt: c.revokedAt || null,
  };
}

function serializeTransaction(transaction) {
  return {
    txHash: transaction.txHash,
    blockNumber: transaction.blockNumber,
    contractAddress: transaction.contractAddress,
    simulated: transaction.simulated,
  };
}

module.exports = { issueCertificate, listCertificates, getCertificate, verifyCertificate, revokeCertificate };
