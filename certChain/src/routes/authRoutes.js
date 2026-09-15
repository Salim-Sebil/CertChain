const express = require("express");
const { body } = require("express-validator");
const { login, setPassword, resetPasswordByToken } = require("../controllers/authController");
const { handleValidation } = require("../middleware/validate");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post(
  "/login",
  [body("email").isEmail().withMessage("A valid email is required."), body("password").notEmpty().withMessage("Password is required.")],
  handleValidation,
  login
);

router.post(
  "/set-password",
  protect,
  [body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long.")],
  handleValidation,
  setPassword
);

router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is required."),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long."),
  ],
  handleValidation,
  resetPasswordByToken
);

module.exports = router;
