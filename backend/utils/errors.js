class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function assert(condition, status, message, details) {
  if (!condition) throw new AppError(status, message, details);
}

module.exports = { AppError, assert };
