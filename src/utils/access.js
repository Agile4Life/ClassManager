const pool = require('../config/db');
const { AppError } = require('./errors');

async function assertTeacherClassAccess(user, classId) {
  if (['admin', 'staff', 'teacher'].includes(user.role)) return;
  throw new AppError(403, 'Access denied');
}

module.exports = { assertTeacherClassAccess };
