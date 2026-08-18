const { validationResult } = require("express-validator");
const AppError = require("../utils/AppError");

/** Drop this after a chain of express-validator checks on a route.
 *  Collects every failed rule into one readable message rather than
 *  exposing express-validator's raw error array. */
function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const message = result.array().map((e) => e.msg).join(" ");
  next(new AppError(message, 400));
}

module.exports = { handleValidation };
