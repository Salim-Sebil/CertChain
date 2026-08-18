/** Centralized error handler — every controller forwards errors here via
 *  next(err) instead of formatting its own JSON error response. */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let statusCode = err.statusCode || 500;
  let message = err.isOperational ? err.message : "Something went wrong. Please try again.";

  // Mongoose duplicate key (e.g. certificate number / email already exists)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    message = `A record with this ${field} already exists.`;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(" ");
  }

  // Malformed ObjectId in a route param
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${err.path}.`;
  }

  if (statusCode >= 500) {
    console.error("[error]", err);
  }

  res.status(statusCode).json({ success: false, message });
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };
