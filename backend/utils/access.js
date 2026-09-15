const pool = require('../config/db');
const { AppError } = require('./errors');

async function assertTeacherClassAccess(user, classId) {
  if (['admin', 'staff'].includes(user.role)) {
    const exists = await pool.query(
      "select 1 from classes where class_id = $1 and status <> 'cancelled'",
      [classId],
    );
    if (exists.rowCount) return;
    throw new AppError(404, 'Class not found');
  }
  if (user.role === 'teacher' && user.teacher_id) {
    const allowed = await pool.query(
      `select 1
       from classes c
       where c.class_id = $1
         and c.status <> 'cancelled'
         and (
           c.teacher_id = $2
           or exists (
             select 1 from class_teachers ct
             where ct.class_id = c.class_id and ct.teacher_id = $2
           )
         )`,
      [classId, user.teacher_id],
    );
    if (allowed.rowCount) return;
  }
  throw new AppError(403, 'Access denied');
}

module.exports = { assertTeacherClassAccess };
