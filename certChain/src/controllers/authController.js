const User = require("../models/User");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/jwt");

/** POST /api/auth/login — Table 4.2 / Section 2.8.1 (FR-A1, FR-S1). */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError("Email and password are required.", 400);

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    // Deliberately identical error for "no such user" and "wrong password" —
    // never reveal which field was wrong (Sprint 1, US-01 acceptance criteria).
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError("Invalid email or password.", 401);
    }

    const token = signToken(user);
    res.json({ success: true, token, user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

async function setPassword(req, res, next) {
  try {
    const { password } = req.body;
    if (!password || password.trim().length < 8) {
      throw new AppError("Password must be at least 8 characters long.", 400);
    }

    if (!req.user) {
      throw new AppError("Authentication required.", 401);
    }

    await req.user.setPassword(password);
    req.user.mustChangePassword = false;
    await req.user.save();

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    next(err);
  }
}

async function resetPasswordByToken(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token) throw new AppError("Reset token is required.", 400);
    if (!password || password.trim().length < 8) {
      throw new AppError("Password must be at least 8 characters long.", 400);
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpiresAt +password");

    if (!user) {
      throw new AppError("This reset link is invalid or expired. Please request a new one.", 400);
    }

    await user.setPassword(password);
    user.mustChangePassword = false;
    await user.save();

    res.json({ success: true, message: "Password reset successfully." });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, setPassword, resetPasswordByToken };
