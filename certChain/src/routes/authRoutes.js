const express = require("express");
const { body } = require("express-validator");
const { login } = require("../controllers/authController");
const { handleValidation } = require("../middleware/validate");

const router = express.Router();

router.post(
  "/login",
  [body("email").isEmail().withMessage("A valid email is required."), body("password").notEmpty().withMessage("Password is required.")],
  handleValidation,
  login
);

module.exports = router;
