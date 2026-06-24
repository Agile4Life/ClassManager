const pool = require('../config/db');
const { AppError } = require('./errors');

async function assertTeacherClassAccess(user, classId) {
  if (['admin', 'staff'].includes(user.role)) return;
  if (user.role === 'teacher' && user.teacher_id) {
    const allowed = await pool.query(
      'select 1 from classes where class_id = $1 and teacher_id = $2',
      [classId, user.teacher_id],
    );
    if (allowed.rowCount) return;
  }
  throw new AppError(403, 'Access denied');
}

module.exports = { assertTeacherClassAccess };
