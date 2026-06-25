const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { success } = require('../utils/response');
const { timeToMinutes, isIsoDate } = require('../utils/validation');
const { assertTeacherClassAccess } = require('../utils/access');
const { getClassTeacherIds, normalizeTeacherIds } = require('../utils/class-teachers');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_ORDER = `case cs.day_of_week ${DAYS.map((day, index) => `when '${day}' then ${index + 1}`).join(' ')} end`;
const BASE_QUERY = `
  select cs.schedule_id, c.class_id, c.class_code, c.class_name,
         sub.subject_id, sub.subject_name,
         coalesce((schedule_teachers.teacher_ids)[1], c.teacher_id) as teacher_id,
         coalesce(schedule_teachers.teacher_ids, case when legacy_teacher.teacher_id is null then '{}'::bigint[] else array[legacy_teacher.teacher_id] end) as teacher_ids,
         coalesce(schedule_teachers.teacher_name, legacy_teacher.full_name) as teacher_name,
         coalesce(schedule_teachers.teachers, case when legacy_teacher.teacher_id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('teacher_id', legacy_teacher.teacher_id, 'full_name', legacy_teacher.full_name)) end) as teachers,
         r.room_id, r.room_name, cs.day_of_week, cs.start_time, cs.end_time
  from class_schedules cs
  join classes c on c.class_id = cs.class_id and c.status <> 'cancelled'
  join subjects sub on sub.subject_id = c.subject_id
  left join teachers legacy_teacher on legacy_teacher.teacher_id = c.teacher_id and legacy_teacher.is_deleted = false
  left join rooms r on r.room_id = cs.room_id`;
const TEACHER_LATERAL = `
  left join lateral (
    select array_agg(t.teacher_id order by t.full_name) as teacher_ids,
           string_agg(t.full_name, ', ' order by t.full_name) as teacher_name,
           jsonb_agg(jsonb_build_object('teacher_id', t.teacher_id, 'full_name', t.full_name) order by t.full_name) as teachers
    from class_schedule_teachers cst
    join teachers t on t.teacher_id = cst.teacher_id and t.is_deleted = false
    where cst.schedule_id = cs.schedule_id
  ) schedule_teachers on true`;
const TIMETABLE_QUERY = `${BASE_QUERY} ${TEACHER_LATERAL}`;

function ensureSelfAccess(user, type, id) {
  if (['admin', 'staff'].includes(user.role)) return;
  const links = { teacher: user.teacher_id, student: user.student_id, parent: user.parent_id };
  if (user.role !== type || String(links[type]) !== String(id)) {
    throw new AppError(403, 'You can only view your own timetable');
  }
}

const getAll = asyncHandler(async (req, res) => {
  const filterMap = {
    day_of_week: 'cs.day_of_week', class_id: 'c.class_id',
    room_id: 'cs.room_id', subject_id: 'c.subject_id',
  };
  const values = [];
  const conditions = [];
  for (const [param, column] of Object.entries(filterMap)) {
    if (req.query[param] !== undefined) {
      values.push(req.query[param]);
      conditions.push(`${column} = $${values.length}`);
    }
  }
  if (req.query.teacher_id !== undefined) {
    values.push(req.query.teacher_id);
    conditions.push(`(
      exists (select 1 from class_schedule_teachers cst where cst.schedule_id = cs.schedule_id and cst.teacher_id = $${values.length})
      or exists (select 1 from class_teachers ct where ct.class_id = c.class_id and ct.teacher_id = $${values.length})
      or c.teacher_id = $${values.length}
    )`);
  } else if (req.user.role === 'teacher') {
    values.push(req.user.teacher_id);
    conditions.push(`(
      exists (select 1 from class_schedule_teachers cst where cst.schedule_id = cs.schedule_id and cst.teacher_id = $${values.length})
      or exists (select 1 from class_teachers ct where ct.class_id = c.class_id and ct.teacher_id = $${values.length})
      or c.teacher_id = $${values.length}
    )`);
  }
  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const result = await pool.query(`${TIMETABLE_QUERY} ${where} order by ${DAY_ORDER}, cs.start_time`, values);
  return success(res, result.rows, 'Timetable fetched successfully');
});

function getBySimpleType(type, condition, enforceOwnership = true) {
  return asyncHandler(async (req, res) => {
    const id = req.params[`${type}Id`];
    if (enforceOwnership) ensureSelfAccess(req.user, type, id);
    const result = await pool.query(`${TIMETABLE_QUERY} where ${condition} order by ${DAY_ORDER}, cs.start_time`, [id]);
    return success(res, result.rows, `${type} timetable fetched successfully`);
  });
}

const getByClass = asyncHandler(async (req, res) => {
  await assertTeacherClassAccess(req.user, req.params.classId);
  const result = await pool.query(`${TIMETABLE_QUERY} where c.class_id = $1 order by ${DAY_ORDER}, cs.start_time`, [req.params.classId]);
  return success(res, result.rows, 'Class timetable fetched successfully');
});

const getByParent = asyncHandler(async (req, res) => {
  ensureSelfAccess(req.user, 'parent', req.params.parentId);
  const result = await pool.query(
    `select p.parent_id, p.full_name as parent_name, s.student_id, s.full_name as student_name,
            c.class_id, c.class_code, c.class_name, sub.subject_name,
            coalesce(schedule_teachers.teacher_name, legacy_teacher.full_name) as teacher_name,
            coalesce(schedule_teachers.teacher_ids, case when legacy_teacher.teacher_id is null then '{}'::bigint[] else array[legacy_teacher.teacher_id] end) as teacher_ids,
            coalesce(schedule_teachers.teachers, case when legacy_teacher.teacher_id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('teacher_id', legacy_teacher.teacher_id, 'full_name', legacy_teacher.full_name)) end) as teachers,
            r.room_name, cs.day_of_week, cs.start_time, cs.end_time
     from parents p
     join student_parents sp on sp.parent_id = p.parent_id
     join students s on s.student_id = sp.student_id
     join enrollments e on e.student_id = s.student_id and e.status = 'studying'
     join classes c on c.class_id = e.class_id and c.status <> 'cancelled'
     join class_schedules cs on cs.class_id = c.class_id
     join subjects sub on sub.subject_id = c.subject_id
     left join teachers legacy_teacher on legacy_teacher.teacher_id = c.teacher_id and legacy_teacher.is_deleted = false
     left join lateral (
       select array_agg(t.teacher_id order by t.full_name) as teacher_ids,
              string_agg(t.full_name, ', ' order by t.full_name) as teacher_name,
              jsonb_agg(jsonb_build_object('teacher_id', t.teacher_id, 'full_name', t.full_name) order by t.full_name) as teachers
       from class_schedule_teachers cst
       join teachers t on t.teacher_id = cst.teacher_id and t.is_deleted = false
       where cst.schedule_id = cs.schedule_id
     ) schedule_teachers on true
     left join rooms r on r.room_id = cs.room_id
     where p.parent_id = $1 order by s.full_name, ${DAY_ORDER}, cs.start_time`,
    [req.params.parentId],
  );
  return success(res, result.rows, 'Parent timetable fetched successfully');
});

async function replaceScheduleTeachers(client, scheduleId, teacherIds) {
  await client.query('delete from class_schedule_teachers where schedule_id = $1', [scheduleId]);
  if (!teacherIds.length) return;
  const placeholders = teacherIds.map((_, index) => `($1, $${index + 2})`).join(', ');
  await client.query(
    `insert into class_schedule_teachers (schedule_id, teacher_id) values ${placeholders} on conflict do nothing`,
    [scheduleId, ...teacherIds],
  );
}

async function getScheduleTeacherIds(client, scheduleId, classId) {
  const current = await client.query(
    `select cst.teacher_id
     from class_schedule_teachers cst
     join teachers t on t.teacher_id = cst.teacher_id and t.is_deleted = false
     where cst.schedule_id = $1
     order by cst.teacher_id`,
    [scheduleId],
  );
  if (current.rowCount) return current.rows.map((row) => Number(row.teacher_id));
  return getClassTeacherIds(client, classId);
}

async function validateAndLockSchedule(client, { classId, roomId, day, start, end, scheduleId = null, teacherIds }) {
  if (!DAYS.includes(day)) throw new AppError(400, 'day_of_week is invalid');
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    throw new AppError(400, 'end_time must be later than start_time');
  }
  const classResult = await client.query(
    "select class_id, teacher_id from classes where class_id = $1 and status <> 'cancelled'",
    [classId],
  );
  if (!classResult.rowCount) throw new AppError(404, 'Class not found');
  const classTeacherIds = await getClassTeacherIds(client, classId);
  const selectedTeacherIds = teacherIds === undefined ? classTeacherIds : normalizeTeacherIds(teacherIds);
  if (classTeacherIds.length && !selectedTeacherIds.length) throw new AppError(400, 'At least one class teacher must be selected for this schedule');
  const classTeacherSet = new Set(classTeacherIds.map(String));
  const invalidTeacherIds = selectedTeacherIds.filter((teacherId) => !classTeacherSet.has(String(teacherId)));
  if (invalidTeacherIds.length) throw new AppError(400, 'Selected teachers must be assigned to this class');
  if (roomId !== null && roomId !== undefined) {
    const room = await client.query("select room_id from rooms where room_id = $1 and status = 'available'", [roomId]);
    if (!room.rowCount) throw new AppError(400, 'Room does not exist or is unavailable');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`room:${roomId}:${day}`]);
    const conflict = await client.query(
      `select cs.schedule_id
       from class_schedules cs
       join classes c on c.class_id = cs.class_id and c.status <> 'cancelled'
       where cs.room_id = $1 and cs.day_of_week = $2
       and $3::time < cs.end_time and $4::time > cs.start_time
       and ($5::bigint is null or cs.schedule_id <> $5) limit 1`,
      [roomId, day, start, end, scheduleId],
    );
    if (conflict.rowCount) throw new AppError(409, 'Room is already booked during this time');
  }
  if (selectedTeacherIds.length) {
    for (const teacherId of selectedTeacherIds) {
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [`teacher:${teacherId}:${day}`]);
    }
    const conflict = await client.query(
      `select cs.schedule_id
       from class_schedules cs
       join classes c on c.class_id = cs.class_id and c.status <> 'cancelled'
       left join class_schedule_teachers cst on cst.schedule_id = cs.schedule_id
       where cs.day_of_week = $2
         and $3::time < cs.end_time and $4::time > cs.start_time
         and ($5::bigint is null or cs.schedule_id <> $5)
         and (
           cst.teacher_id = any($1::bigint[])
           or (cst.teacher_id is null and c.teacher_id = any($1::bigint[]))
         )
       limit 1`,
      [selectedTeacherIds, day, start, end, scheduleId],
    );
    if (conflict.rowCount) throw new AppError(409, 'Teacher already has another class during this time');
  }
  return selectedTeacherIds;
}

const createSchedule = asyncHandler(async (req, res) => {
  const { room_id: roomId = null, day_of_week: day, start_time: start, end_time: end } = req.body;
  const client = await pool.connect();
  try {
    await client.query('begin');
    const teacherIds = await validateAndLockSchedule(client, {
      classId: req.params.classId, roomId, day, start, end, teacherIds: req.body.teacher_ids,
    });
    const result = await client.query(
      `insert into class_schedules (class_id, room_id, day_of_week, start_time, end_time)
       values ($1, $2, $3, $4, $5) returning *`,
      [req.params.classId, roomId, day, start, end],
    );
    await replaceScheduleTeachers(client, result.rows[0].schedule_id, teacherIds);
    await client.query('commit');
    return success(res, result.rows[0], 'Schedule created successfully', 201);
  } catch (error) {
    await client.query('rollback'); throw error;
  } finally { client.release(); }
});

const updateSchedule = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const currentResult = await client.query('select * from class_schedules where schedule_id = $1 for update', [req.params.scheduleId]);
    if (!currentResult.rowCount) throw new AppError(404, 'Schedule not found');
    const current = currentResult.rows[0];
    await assertTeacherClassAccess(req.user, current.class_id);
    const currentTeacherIds = await getScheduleTeacherIds(client, req.params.scheduleId, current.class_id);
    const input = {
      classId: current.class_id,
      roomId: req.body.room_id !== undefined ? req.body.room_id : current.room_id,
      day: req.body.day_of_week !== undefined ? req.body.day_of_week : current.day_of_week,
      start: req.body.start_time !== undefined ? req.body.start_time : current.start_time,
      end: req.body.end_time !== undefined ? req.body.end_time : current.end_time,
      scheduleId: req.params.scheduleId,
      teacherIds: req.body.teacher_ids !== undefined ? req.body.teacher_ids : currentTeacherIds,
    };
    const teacherIds = await validateAndLockSchedule(client, input);
    const result = await client.query(
      `update class_schedules set room_id = $1, day_of_week = $2, start_time = $3, end_time = $4
       where schedule_id = $5 returning *`,
      [input.roomId, input.day, input.start, input.end, req.params.scheduleId],
    );
    await replaceScheduleTeachers(client, req.params.scheduleId, teacherIds);
    await client.query('commit');
    return success(res, result.rows[0], 'Schedule updated successfully');
  } catch (error) {
    await client.query('rollback'); throw error;
  } finally { client.release(); }
});

const deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await pool.query('select class_id from class_schedules where schedule_id = $1', [req.params.scheduleId]);
  if (!schedule.rowCount) throw new AppError(404, 'Schedule not found');
  await assertTeacherClassAccess(req.user, schedule.rows[0].class_id);
  const result = await pool.query('delete from class_schedules where schedule_id = $1 returning schedule_id', [req.params.scheduleId]);
  if (!result.rowCount) throw new AppError(404, 'Schedule not found');
  return success(res, result.rows[0], 'Schedule deleted successfully');
});

const generateSessions = asyncHandler(async (req, res) => {
  const { from_date: fromDate, to_date: toDate } = req.body;
  if (!fromDate || !toDate) throw new AppError(400, 'from_date and to_date are required');
  if (!isIsoDate(fromDate) || !isIsoDate(toDate)) throw new AppError(400, 'from_date and to_date must use YYYY-MM-DD format');
  await assertTeacherClassAccess(req.user, req.params.classId);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`generate-sessions:${req.params.classId}`]);
    const classResult = await client.query(
      "select 1 from classes where class_id = $1 and status <> 'cancelled'",
      [req.params.classId],
    );
    if (!classResult.rowCount) throw new AppError(404, 'Class not found');
    const range = await client.query('select ($2::date - $1::date) as days', [fromDate, toDate]);
    if (range.rows[0].days < 0 || range.rows[0].days > 366) throw new AppError(400, 'Date range must be between 0 and 366 days');
    const result = await client.query(
      `insert into class_sessions (class_id, session_date, start_time, end_time, status)
       select cs.class_id, d::date, cs.start_time, cs.end_time, 'scheduled'
       from class_schedules cs
       cross join generate_series($2::date, $3::date, interval '1 day') d
       where cs.class_id = $1
         and extract(isodow from d) = array_position(
           array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
           cs.day_of_week
         )
         and not exists (
           select 1 from class_sessions existing
           where existing.class_id = cs.class_id and existing.session_date = d::date
             and existing.start_time = cs.start_time
         ) returning *`,
      [req.params.classId, fromDate, toDate],
    );
    await client.query('commit');
    return success(res, { created_count: result.rowCount, sessions: result.rows }, 'Class sessions generated successfully', 201);
  } catch (error) {
    await client.query('rollback'); throw error;
  } finally { client.release(); }
});

module.exports = {
  getAll, getByClass,
  getByTeacher: getBySimpleType('teacher', `(
    exists (select 1 from class_schedule_teachers cst where cst.schedule_id = cs.schedule_id and cst.teacher_id = $1)
    or exists (select 1 from class_teachers ct where ct.class_id = c.class_id and ct.teacher_id = $1)
    or c.teacher_id = $1
  )`),
  getByStudent: getBySimpleType('student', `c.class_id in (select class_id from enrollments where student_id = $1 and status = 'studying')`),
  getByRoom: getBySimpleType('room', 'cs.room_id = $1', false),
  getByParent, createSchedule, updateSchedule, deleteSchedule, generateSessions,
};
