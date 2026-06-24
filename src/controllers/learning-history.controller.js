const crypto = require('crypto');
const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { getPagination } = require('../utils/validation');
const { success } = require('../utils/response');
const { assertTeacherClassAccess } = require('../utils/access');

const REPORT_THRESHOLD = 4;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function getCategoryKey(templateId, detail) {
  const safeTemplateId = cleanText(templateId, 80);
  if (safeTemplateId && safeTemplateId !== 'custom') return safeTemplateId;
  return `custom:${crypto.createHash('sha256').update(detail.toLocaleLowerCase('vi')).digest('hex').slice(0, 32)}`;
}

function reportSummary(label, count) {
  return `${label} đã được ghi nhận ${count} lần trong quá trình học tập.`;
}

const createEvents = asyncHandler(async (req, res) => {
  const classId = req.body.class_id;
  const observations = Array.isArray(req.body.observations) ? req.body.observations : [];
  if (!classId || !observations.length) {
    throw new AppError(400, 'class_id and observations are required');
  }
  if (observations.length > 50) throw new AppError(400, 'A notification can contain at most 50 observation groups');
  await assertTeacherClassAccess(req.user, classId);

  const classResult = await pool.query(
    'select class_id, class_name, teacher_id from classes where class_id = $1',
    [classId],
  );
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
      await client.query(
        'select pg_advisory_xact_lock(hashtext($1))',
        [`learning-history:${entry.studentId}:${entry.categoryKey}`],
      );
      const existingReport = await client.query(
        `select report_id, status from progress_reports
         where student_id = $1 and report_source = 'learning_history' and source_key = $2
         limit 1`,
        [entry.studentId, entry.categoryKey],
      );
      let reportId = existingReport.rows[0]?.report_id || null;
      const inserted = await client.query(
        `insert into student_learning_events
           (student_id, class_id, teacher_id, recorded_by_user_id, report_id,
            category_key, category_label, detail, student_note, notification_text)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         returning *`,
        [entry.studentId, classId, req.user.role === 'teacher' ? req.user.teacher_id : classResult.rows[0].teacher_id,
          req.user.user_id, reportId, entry.categoryKey, entry.label, entry.detail, entry.studentNote,
          cleanText(req.body.notification_text, 10000) || null],
      );
      const countResult = await client.query(
        'select count(*)::int as total from student_learning_events where student_id = $1 and category_key = $2',
        [entry.studentId, entry.categoryKey],
      );
      const occurrenceCount = countResult.rows[0].total;
      let reportCreated = false;

      if (occurrenceCount >= REPORT_THRESHOLD && !reportId) {
        const parentResult = await client.query(
          `select parent_id from student_parents where student_id = $1
           order by is_primary_contact desc, parent_id limit 1`,
          [entry.studentId],
        );
        const firstEvent = await client.query(
          `select created_at::date as first_date from student_learning_events
           where student_id = $1 and category_key = $2 order by created_at limit 1`,
          [entry.studentId, entry.categoryKey],
        );
        const report = await client.query(
          `insert into progress_reports
             (student_id, class_id, teacher_id, parent_id, report_title, period_start, period_end,
              weakness_summary, teacher_recommendation, status, report_source, source_key)
           values ($1, $2, $3, $4, $5, $6, current_date, $7, $8, 'draft', 'learning_history', $9)
           returning report_id`,
          [entry.studentId, classId,
            req.user.role === 'teacher' ? req.user.teacher_id : classResult.rows[0].teacher_id,
            parentResult.rows[0]?.parent_id || null, `Cảnh báo lặp lại: ${entry.label}`.slice(0, 200),
            firstEvent.rows[0].first_date, reportSummary(entry.label, occurrenceCount),
            'Giáo viên cần xem lại lịch sử, trao đổi với học sinh và bổ sung hướng hỗ trợ phù hợp.',
            entry.categoryKey],
        );
        reportId = report.rows[0].report_id;
        reportCreated = true;
        await client.query(
          `update student_learning_events set report_id = $1
           where student_id = $2 and category_key = $3`,
          [reportId, entry.studentId, entry.categoryKey],
        );
      } else if (reportId && existingReport.rows[0].status === 'draft') {
        await client.query(
          `update progress_reports set period_end = current_date, weakness_summary = $1
           where report_id = $2`,
          [reportSummary(entry.label, occurrenceCount), reportId],
        );
      }

      saved.push({ ...inserted.rows[0], report_id: reportId, occurrence_count: occurrenceCount, report_created: reportCreated });
    }
    await client.query('commit');
    return success(res, {
      items: saved,
      reports_created: saved.filter((item) => item.report_created).length,
    }, 'Learning history saved successfully', 201);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const listEvents = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const values = [];
  const conditions = [];
  if (req.user.role === 'teacher') {
    values.push(req.user.teacher_id);
    conditions.push(`e.class_id in (select class_id from classes where teacher_id = $${values.length})`);
  }
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
    `with scoped as (
       select e.student_id, e.category_key from student_learning_events e ${where}
     ), scoped_pairs as (
       select distinct student_id, category_key from scoped
     ), global_counts as (
       select student_id, category_key, count(*)::int as occurrences
       from student_learning_events group by student_id, category_key
     )
     select (select count(*)::int from scoped) as total_events,
            (select count(distinct student_id)::int from scoped) as students_count,
            (select count(*)::int from scoped_pairs p join global_counts g using (student_id, category_key)
             where g.occurrences >= ${REPORT_THRESHOLD}) as flagged_categories`,
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
            ua.full_name as recorded_by_name, counts.occurrence_count,
            pr.status as report_status
     from student_learning_events e
     join students s on s.student_id = e.student_id
     left join classes c on c.class_id = e.class_id
     left join teachers t on t.teacher_id = e.teacher_id
     left join user_accounts ua on ua.user_id = e.recorded_by_user_id
     left join progress_reports pr on pr.report_id = e.report_id
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

module.exports = { createEvents, listEvents, REPORT_THRESHOLD };
