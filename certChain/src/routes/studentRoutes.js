const express = require("express");
const { body } = require("express-validator");
const { registerStudent, listStudents } = require("../controllers/studentController");
const { protect, restrictTo } = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");

const router = express.Router();

router.use(protect, restrictTo("admin"));

router.get("/", listStudents);

router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("A valid email is required."),
    body("studentNumber").notEmpty().withMessage("Student number is required."),
    body("programme").notEmpty().withMessage("Programme is required."),
    body("department").notEmpty().withMessage("Department is required."),
    body("graduationYear").isInt({ min: 2000, max: 2100 }).withMessage("Graduation year must be valid."),
  ],
  handleValidation,
  registerStudent
);

module.exports = router;
