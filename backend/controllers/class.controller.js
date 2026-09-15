const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { pick, buildUpdate } = require('../utils/query');
const { success } = require('../utils/response');
const { assertTeacherClassAccess } = require('../utils/access');

const linkParent = asyncHandler(async (req, res) => {
  const { relationship, is_primary_contact = false } = req.body;
  if (!relationship) throw new AppError(400, 'relationship is required');
  const result = await pool.query(
    `insert into student_parents (student_id, parent_id, relationship, is_primary_contact)
     values ($1, $2, $3, $4)
     on conflict (student_id, parent_id) do update
     set relationship = excluded.relationship, is_primary_contact = excluded.is_primary_contact
     returning *`,
    [req.params.studentId, req.params.parentId, relationship, is_primary_contact],
  );
  return success(res, result.rows[0], 'Parent linked to student successfully', 201);
});

const getStudentParents = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `select p.*, sp.relationship, sp.is_primary_contact
     from student_parents sp join parents p on p.parent_id = sp.parent_id
     where sp.student_id = $1 order by sp.is_primary_contact desc, p.full_name`,
    [req.params.studentId],
  );
  return success(res, result.rows, 'Student parents fetched successfully');
});

const getClassStudents = asyncHandler(async (req, res) => {
  await assertTeacherClassAccess(req.user, req.params.classId);
  await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
  const result = await pool.query(
    `select e.enrollment_id, e.enrolled_date, e.status as enrollment_status,
            e.discount_percent, e.note as enrollment_note, s.*
     from enrollments e join students s on s.student_id = e.student_id
     join classes c on c.class_id = e.class_id and c.status <> 'cancelled'
     where e.class_id = $1 and (s.is_deleted = false or s.is_deleted is null) and s.status <> 'inactive'
     order by s.full_name`,
    [req.params.classId],
  );
  return success(res, result.rows, 'Class students fetched successfully');
});

const enrollStudent = asyncHandler(async (req, res) => {
  const { enrolled_date, status = 'studying', discount_percent = 0, note } = req.body;
  const client = await pool.connect();
  try {
    await client.query('begin');
    const classResult = await client.query(
      "select class_id, max_students from classes where class_id = $1 and status <> 'cancelled' for update",
      [req.params.classId],
    );
    if (!classResult.rowCount) throw new AppError(404, 'Class not found');
    const studentResult = await client.query('select student_id from students where student_id = $1', [req.params.studentId]);
    if (!studentResult.rowCount) throw new AppError(404, 'Student not found');
    const existingEnrollment = await client.query(
      'select enrollment_id from enrollments where class_id = $1 and student_id = $2',
      [req.params.classId, req.params.studentId],
    );
    if (existingEnrollment.rowCount) throw new AppError(409, 'Student is already enrolled in this class');
    const countResult = await client.query(
      `select count(*)::int as total from enrollments where class_id = $1 and status = 'studying'`,
      [req.params.classId],
    );
    if (countResult.rows[0].total >= classResult.rows[0].max_students) throw new AppError(409, 'Class has reached its student capacity');
    const result = await client.query(
      `insert into enrollments (student_id, class_id, enrolled_date, status, discount_percent, note)
       values ($1, $2, coalesce($3::date, current_date), $4, $5, $6) returning *`,
      [req.params.studentId, req.params.classId, enrolled_date || null, status, discount_percent, note || null],
    );
    await client.query('commit');
    return success(res, result.rows[0], 'Student enrolled successfully', 201);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const updateEnrollment = asyncHandler(async (req, res) => {
  const query = buildUpdate(
    'enrollments', 'enrollment_id', req.params.id,
    pick(req.body, ['enrolled_date', 'status', 'discount_percent', 'note']),
  );
  const result = await pool.query(query);
  if (!result.rowCount) throw new AppError(404, 'Enrollment not found');
  return success(res, result.rows[0], 'Enrollment updated successfully');
});

const deleteEnrollment = asyncHandler(async (req, res) => {
  const result = await pool.query('delete from enrollments where enrollment_id = $1 returning enrollment_id', [req.params.id]);
  if (!result.rowCount) throw new AppError(404, 'Enrollment not found');
  return success(res, result.rows[0], 'Enrollment deleted successfully');
});

module.exports = { linkParent, getStudentParents, getClassStudents, enrollStudent, updateEnrollment, deleteEnrollment };
