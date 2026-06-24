const crypto = require('crypto');
const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { getPagination } = require('../utils/validation');
const { success } = require('../utils/response');
const { assertTeacherClassAccess } = require('../utils/access');

let schemaReadyPromise;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function getCategoryKey(templateId, detail) {
  const safeTemplateId = cleanText(templateId, 80);
  if (safeTemplateId && safeTemplateId !== 'custom') return safeTemplateId;
  return `custom:${crypto.createHash('sha256').update(detail.toLocaleLowerCase('vi')).digest('hex').slice(0, 32)}`;
}

function ensureLearningHistorySchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query("select pg_advisory_xact_lock(hashtext('classmanager:learning-history-schema'))");
        await client.query(
          `create table if not exists student_learning_events (
             event_id bigint generated always as identity primary key,
             student_id bigint not null references students(student_id) on delete cascade,
             class_id bigint references classes(class_id) on delete set null,
             teacher_id bigint references teachers(teacher_id) on delete set null,
             recorded_by_user_id bigint references user_accounts(user_id) on delete set null,
             category_key varchar(100) not null,
             category_label varchar(200) not null,
             detail text not null,
             student_note varchar(200),
             notification_text text,
             created_at timestamptz not null default now()
           )`,
        );
        await client.query(
          `create index if not exists idx_learning_events_student_category
           on student_learning_events(student_id, category_key, created_at desc)`,
        );
        await client.query(
          `create index if not exists idx_learning_events_class_created
           on student_learning_events(class_id, created_at desc)`,
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}

const createEvents = asyncHandler(async (req, res) => {
  await ensureLearningHistorySchema();
  const classId = req.body.class_id;
  const observations = Array.isArray(req.body.observations) ? req.body.observations : [];
  if (!classId || !observations.length) throw new AppError(400, 'class_id and observations are required');
  if (observations.length > 50) throw new AppError(400, 'A notification can contain at most 50 observation groups');
  await assertTeacherClassAccess(req.user, classId);

  const classResult = await pool.query('select class_id, teacher_id from classes where class_id = $1', [classId]);
  if (!classResult.rowCount) throw new AppError(404, 'Class not found');

  const flattened = new Map();
  for (const observation of observations) {
    const detail = cleanText(observation.detail, 2000);
    const label = cleanText(observation.category_label, 200);
    const studentIds = Array.isArray(observation.student_ids) ? observation.student_ids : [];
    if (!detail || !label || !studentIds.length) continue;
    const categoryKey = getCategoryKey(observation.template_id, detail);
    for (const studentId of studentIds) {
      if (!/^\d+$/.test(String(studentId))) throw new AppError(400, 'student_ids contains an invalid value');
      const dedupeKey = `${studentId}:${categoryKey}`;
      if (!flattened.has(dedupeKey)) {
        flattened.set(dedupeKey, {
          studentId: String(studentId), categoryKey, label, detail,
          studentNote: cleanText(observation.student_note, 200) || null,
        });
      }
    }
  }
  const entries = [...flattened.values()].sort((left, right) => (
    left.studentId.localeCompare(right.studentId, undefined, { numeric: true })
      || left.categoryKey.localeCompare(right.categoryKey)
  ));
  if (!entries.length) throw new AppError(400, 'No selected students with valid observations were provided');
  if (entries.length > 500) throw new AppError(400, 'A notification can mark at most 500 student items');

  const client = await pool.connect();
  try {
    await client.query('begin');
    const studentIds = [...new Set(entries.map((entry) => entry.studentId))];
    const enrolled = await client.query(
      `select student_id from enrollments
       where class_id = $1 and student_id = any($2::bigint[])
         and status in ('studying', 'completed')`,
      [classId, studentIds],
    );
    const enrolledIds = new Set(enrolled.rows.map((row) => String(row.student_id)));
    const invalidIds = studentIds.filter((studentId) => !enrolledIds.has(studentId));
    if (invalidIds.length) throw new AppError(400, `Students are not enrolled in this class: ${invalidIds.join(', ')}`);

    const saved = [];
    for (const entry of entries) {
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [`learning-history:${entry.studentId}:${entry.categoryKey}`]);
      const inserted = await client.query(
        `insert into student_learning_events
           (student_id, class_id, teacher_id, recorded_by_user_id,
            category_key, category_label, detail, student_note, notification_text)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning *`,
        [entry.studentId, classId,
          req.user.role === 'teacher' ? req.user.teacher_id : classResult.rows[0].teacher_id,
          req.user.user_id, entry.categoryKey, entry.label, entry.detail, entry.studentNote,
          cleanText(req.body.notification_text, 10000) || null],
      );
      const countResult = await client.query(
        'select count(*)::int as total from student_learning_events where student_id = $1 and category_key = $2',
        [entry.studentId, entry.categoryKey],
      );
      saved.push({ ...inserted.rows[0], occurrence_count: countResult.rows[0].total });
    }
    await client.query('commit');
    return success(res, { items: saved }, 'Learning history saved successfully', 201);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const listEvents = asyncHandler(async (req, res) => {
  await ensureLearningHistorySchema();
  const { page, limit, offset } = getPagination(req.query);
  const values = [];
  const conditions = [];
  for (const field of ['class_id', 'student_id']) {
    if (req.query[field] !== undefined && req.query[field] !== '') {
      if (!/^\d+$/.test(String(req.query[field]))) throw new AppError(400, `${field} is invalid`);
      values.push(req.query[field]);
      conditions.push(`e.${field} = $${values.length}`);
    }
  }
  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const countResult = await pool.query(`select count(*)::int as total from student_learning_events e ${where}`, values);
  const summaryResult = await pool.query(
    `select count(*)::int as total_events, count(distinct e.student_id)::int as students_count
     from student_learning_events e ${where}`,
    values,
  );
  const listValues = [...values, limit, offset];
  const result = await pool.query(
    `with counts as (
       select student_id, category_key, count(*)::int as occurrence_count
       from student_learning_events group by student_id, category_key
     )
     select e.*, s.student_code, s.full_name as student_name,
            c.class_code, c.class_name, t.full_name as teacher_name,
            ua.full_name as recorded_by_name, counts.occurrence_count
     from student_learning_events e
     join students s on s.student_id = e.student_id
     left join classes c on c.class_id = e.class_id
     left join teachers t on t.teacher_id = e.teacher_id
     left join user_accounts ua on ua.user_id = e.recorded_by_user_id
     join counts on counts.student_id = e.student_id and counts.category_key = e.category_key
     ${where}
     order by e.created_at desc, e.event_id desc
     limit $${listValues.length - 1} offset $${listValues.length}`,
    listValues,
  );
  return success(res, {
    items: result.rows,
    summary: summaryResult.rows[0],
    pagination: { page, limit, total: countResult.rows[0].total },
  }, 'Learning history fetched successfully');
});

const removeEvent = asyncHandler(async (req, res) => {
  await ensureLearningHistorySchema();
  const result = await pool.query('delete from student_learning_events where event_id = $1 returning event_id', [req.params.id]);
  if (!result.rowCount) throw new AppError(404, 'Learning event not found');
  return success(res, result.rows[0], 'Learning event deleted successfully');
});

module.exports = { createEvents, listEvents, removeEvent, ensureLearningHistorySchema };
