const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { pick, buildUpdate } = require('../utils/query');
const { success } = require('../utils/response');
const { timeToMinutes, isIsoDate, assertOptionalIsoDate } = require('../utils/validation');
const { assertTeacherClassAccess } = require('../utils/access');

async function getSessionForAccess(sessionId, user) {
  const result = await pool.query('select * from class_sessions where session_id = $1', [sessionId]);
  if (!result.rowCount) throw new AppError(404, 'Class session not found');
  await assertTeacherClassAccess(user, result.rows[0].class_id);
  return result.rows[0];
}

const listSessions = asyncHandler(async (req, res) => {
  await assertTeacherClassAccess(req.user, req.params.classId);
  const values = [req.params.classId];
  const conditions = ['class_id = $1'];
  for (const field of ['status', 'from_date', 'to_date']) {
    if (req.query[field] !== undefined) {
      if (field === 'from_date' || field === 'to_date') assertOptionalIsoDate(req.query[field], field);
      values.push(req.query[field]);
      if (field === 'from_date') conditions.push(`session_date >= $${values.length}`);
      else if (field === 'to_date') conditions.push(`session_date <= $${values.length}`);
      else conditions.push(`status = $${values.length}`);
    }
  }
  const result = await pool.query(
    `select * from class_sessions where ${conditions.join(' and ')} order by session_date, start_time`, values,
  );
  return success(res, result.rows, 'Class sessions fetched successfully');
});

const createSession = asyncHandler(async (req, res) => {
  await assertTeacherClassAccess(req.user, req.params.classId);
  const { session_date: date, start_time: start, end_time: end, topic, status = 'scheduled', note } = req.body;
  if (!date) throw new AppError(400, 'session_date is required');
  if (!isIsoDate(date)) throw new AppError(400, 'session_date must use YYYY-MM-DD format');
  if ((start && timeToMinutes(start) === null) || (end && timeToMinutes(end) === null)
      || (start && end && timeToMinutes(start) >= timeToMinutes(end))) {
    throw new AppError(400, 'end_time must be later than start_time');
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`class-session:${req.params.classId}:${date}`]);
    const duplicate = await client.query(
      `select 1 from class_sessions where class_id = $1 and session_date = $2 and start_time is not distinct from $3::time`,
      [req.params.classId, date, start || null],
    );
    if (duplicate.rowCount) throw new AppError(409, 'A class session already exists at this date and time');
    const result = await client.query(
      `insert into class_sessions (class_id, session_date, start_time, end_time, topic, status, note)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [req.params.classId, date, start || null, end || null, topic || null, status, note || null],
    );
    await client.query('commit');
    return success(res, result.rows[0], 'Class session created successfully', 201);
  } catch (error) {
    await client.query('rollback'); throw error;
  } finally { client.release(); }
});

const updateSession = asyncHandler(async (req, res) => {
  await getSessionForAccess(req.params.sessionId, req.user);
  const values = pick(req.body, ['session_date', 'start_time', 'end_time', 'topic', 'status', 'note']);
  if ((values.start_time && timeToMinutes(values.start_time) === null)
      || (values.end_time && timeToMinutes(values.end_time) === null)
      || (values.start_time && values.end_time && timeToMinutes(values.start_time) >= timeToMinutes(values.end_time))) {
    throw new AppError(400, 'end_time must be later than start_time');
  }
  const result = await pool.query(buildUpdate('class_sessions', 'session_id', req.params.sessionId, values));
  return success(res, result.rows[0], 'Class session updated successfully');
});

const deleteSession = asyncHandler(async (req, res) => {
  await getSessionForAccess(req.params.sessionId, req.user);
  const result = await pool.query('delete from class_sessions where session_id = $1 returning session_id', [req.params.sessionId]);
  return success(res, result.rows[0], 'Class session deleted successfully');
});

const getAttendance = asyncHandler(async (req, res) => {
  await getSessionForAccess(req.params.sessionId, req.user);
  const result = await pool.query(
    `select a.*, s.student_code, s.full_name as student_name
     from attendance a join students s on s.student_id = a.student_id
     where a.session_id = $1 order by s.full_name`,
    [req.params.sessionId],
  );
  return success(res, result.rows, 'Attendance fetched successfully');
});

const saveAttendance = asyncHandler(async (req, res) => {
  const session = await getSessionForAccess(req.params.sessionId, req.user);
  const entries = Array.isArray(req.body.attendance) ? req.body.attendance : [req.body];
  if (!entries.length || entries.some((entry) => !entry.student_id || !entry.status)) {
    throw new AppError(400, 'Each attendance entry requires student_id and status');
  }
  const allowedStatuses = ['present', 'absent', 'late', 'excused'];
  if (entries.some((entry) => !allowedStatuses.includes(entry.status))) throw new AppError(400, 'Attendance status is invalid');

  const client = await pool.connect();
  try {
    await client.query('begin');
    const studentIds = entries.map((entry) => String(entry.student_id));
    if (new Set(studentIds).size !== studentIds.length) {
      throw new AppError(400, 'Attendance contains duplicate students');
    }
    const enrolled = await client.query(
      `select student_id from enrollments
       where class_id = $1 and student_id = any($2::bigint[])
         and status in ('studying', 'completed')`,
      [session.class_id, studentIds],
    );
    const enrolledIds = new Set(enrolled.rows.map((row) => String(row.student_id)));
    const notEnrolled = studentIds.filter((studentId) => !enrolledIds.has(studentId));
    if (notEnrolled.length) {
      throw new AppError(400, `Students are not enrolled in this class: ${notEnrolled.join(', ')}`);
    }

    const placeholders = entries.map((entry, index) => {
      const offset = index * 5;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    });
    const params = entries.flatMap((entry) => [
      req.params.sessionId,
      entry.student_id,
      entry.status,
      entry.check_in_time || null,
      entry.note || null,
    ]);
    const result = await client.query(
      `insert into attendance (session_id, student_id, status, check_in_time, note)
       values ${placeholders.join(', ')}
       on conflict (session_id, student_id) do update
       set status = excluded.status,
           check_in_time = excluded.check_in_time,
           note = excluded.note
       returning *`,
      params,
    );
    await client.query('commit');
    return success(res, result.rows, 'Attendance saved successfully', 201);
  } catch (error) {
    await client.query('rollback'); throw error;
  } finally { client.release(); }
});

const updateAttendance = asyncHandler(async (req, res) => {
  const existing = await pool.query(
    `select a.attendance_id, cs.class_id from attendance a
     join class_sessions cs on cs.session_id = a.session_id where a.attendance_id = $1`,
    [req.params.attendanceId],
  );
  if (!existing.rowCount) throw new AppError(404, 'Attendance record not found');
  await assertTeacherClassAccess(req.user, existing.rows[0].class_id);
  const result = await pool.query(buildUpdate(
    'attendance', 'attendance_id', req.params.attendanceId,
    pick(req.body, ['status', 'check_in_time', 'note']),
  ));
  return success(res, result.rows[0], 'Attendance updated successfully');
});

module.exports = { listSessions, createSession, updateSession, deleteSession, getAttendance, saveAttendance, updateAttendance };
