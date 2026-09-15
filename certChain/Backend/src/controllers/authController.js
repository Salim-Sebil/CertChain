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

module.exports = { login };
