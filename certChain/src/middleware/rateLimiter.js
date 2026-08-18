const rateLimit = require("express-rate-limit");

/** Section 4.4.7 — the verification endpoint is public (no login), so it
 *  is the one most exposed to automated abuse; everything else is
 *  already behind JWT auth. Limits are configurable via .env. */
const verifyLimiter = rateLimit({
  windowMs: Number(process.env.VERIFY_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.VERIFY_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many verification requests. Please try again shortly." },
});

module.exports = { verifyLimiter };
