const express = require("express");
const { body, param } = require("express-validator");
const {
  issueCertificate,
  listCertificates,
  getCertificate,
  verifyCertificate,
  revokeCertificate,
} = require("../controllers/certificateController");
const { protect, restrictTo } = require("../middleware/auth");
const { verifyLimiter } = require("../middleware/rateLimiter");
const { handleValidation } = require("../middleware/validate");

const router = express.Router();

// Public, rate-limited — must be declared before "/:id" so "verify"
// is never swallowed as an :id param.
router.post(
  "/verify",
  verifyLimiter,
  [
    body("certificateNumber").optional().isString().trim(),
    body("hash").optional().isString().trim(),
  ],
  handleValidation,
  verifyCertificate
);

// Everything below requires a logged-in user (admin or student).
router.use(protect);

router.get("/", listCertificates);

router.post(
  "/issue",
  restrictTo("admin"),
  [
    body("studentId").isMongoId().withMessage("A valid studentId is required."),
    body("degree").notEmpty().withMessage("Degree is required."),
    body("issueDate").isISO8601().withMessage("A valid issueDate is required."),
  ],
  handleValidation,
  issueCertificate
);

router.get("/:id", [param("id").isMongoId()], handleValidation, getCertificate);

router.post(
  "/:id/revoke",
  restrictTo("admin"),
  [param("id").isMongoId()],
  handleValidation,
  revokeCertificate
);

module.exports = router;
