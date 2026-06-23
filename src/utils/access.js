const pool = require('../config/db');
const { AppError } = require('./errors');

async function assertTeacherClassAccess(user, classId) {
  if (['admin', 'staff'].includes(user.role)) return;
  if (user.role !== 'teacher') throw new AppError(403, 'Teacher access is required');
  const result = await pool.query(
    'select 1 from classes where class_id = $1 and teacher_id = $2',
    [classId, user.teacher_id],
  );
  if (!result.rowCount) throw new AppError(403, 'This class is not assigned to you');
}

module.exports = { assertTeacherClassAccess };
