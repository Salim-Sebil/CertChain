const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");

/** Section 4.4.7 — every protected endpoint requires a short-lived,
 *  signed JWT that encodes the user's role, checked here on every
 *  request rather than trusted from the client. */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new AppError("Not authenticated. Include a Bearer token.", 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) throw new AppError("The user for this token no longer exists.", 401);

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return next(new AppError("Invalid or expired session. Please log in again.", 401));
    }
    next(err);
  }
}

/** Usage: restrictTo("admin") — role-based access control, Section 4.3.1. */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action.", 403));
    }
    next();
  };
}

module.exports = { protect, restrictTo };
