const { AppError } = require('../utils/errors');

function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = requireRole;
