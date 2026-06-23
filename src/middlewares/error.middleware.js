const { AppError } = require('../utils/errors');
const { failure } = require('../utils/response');

function notFound(req, res) {
  return failure(res, 'Route not found', 404);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return failure(res, 'Request body contains invalid JSON', 400);
  }
  if (error.message === 'Origin is not allowed by CORS') {
    return failure(res, error.message, 403);
  }

  if (error instanceof AppError) {
    return failure(res, error.message, error.status, error.details);
  }

  const postgresErrors = {
    '23505': [409, 'A record with the same unique value already exists'],
    '23503': [409, 'The record is referenced by other data or its relation does not exist'],
    '23514': [400, 'The supplied value violates a database constraint'],
    '22P02': [400, 'Invalid value format'],
    '22007': [400, 'Invalid date or time format'],
    '22008': [400, 'Date or time value is out of range'],
  };
  if (postgresErrors[error.code]) {
    const [status, message] = postgresErrors[error.code];
    return failure(res, message, status, error.detail);
  }

  console.error(error);
  return failure(res, 'Internal server error', 500, error.message);
}

module.exports = { notFound, errorHandler };
