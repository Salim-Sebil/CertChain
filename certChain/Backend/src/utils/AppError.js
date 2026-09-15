/** A deliberate, expected error (bad input, not found, unauthorized) as
 *  opposed to a bug — errorHandler.js uses `isOperational` to decide
 *  whether to expose the message to the client or hide it. */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
