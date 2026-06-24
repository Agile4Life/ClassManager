const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { pick, buildInsert, buildUpdate } = require('../utils/query');
const { success } = require('../utils/response');
const { assertTeacherClassAccess: assertTeacherReportClass } = require('../utils/access');

async function assertStudentVisibility(user, studentId) {
  if (['admin', 'staff'].includes(user.role)) return;
  if (user.role === 'student' && String(user.student_id) === String(studentId)) return;
  if (user.role === 'parent') {
    const result = await pool.query('select 1 from student_parents where parent_id = $1 and student_id = $2', [user.parent_id, studentId]);
    if (result.rowCount) return;
  }
  if (user.role === 'teacher') {
    const result = await pool.query(
      `select 1 from enrollments e join classes c on c.class_id = e.class_id
       where e.student_id = $1 and c.teacher_id = $2 limit 1`, [studentId, user.teacher_id],
    );
    if (result.rowCount) return;
  }
  throw new AppError(403, 'You do not have access to this student');
}

const getStudentReports = asyncHandler(async (req, res) => {
  await assertStudentVisibility(req.user, req.params.studentId);
  const onlySent = ['student', 'parent'].includes(req.user.role);
  const result = await pool.query(
    `select pr.*, c.class_code, c.class_name, t.full_name as teacher_name, p.full_name as parent_name
     from progress_reports pr
     left join classes c on c.class_id = pr.class_id
     left join teachers t on t.teacher_id = pr.teacher_id
     left join parents p on p.parent_id = pr.parent_id
     where pr.student_id = $1 ${onlySent ? "and pr.status = 'sent'" : ''}
     order by pr.created_at desc`, [req.params.studentId],
  );
  return success(res, result.rows, 'Student reports fetched successfully');
});

const createReport = asyncHandler(async (req, res) => {
  if (!req.body.student_id || !req.body.report_title) throw new AppError(400, 'student_id and report_title are required');
  if (req.body.class_id) {
    await assertTeacherReportClass(req.user, req.body.class_id);
    const enrolled = await pool.query(
      'select 1 from enrollments where class_id = $1 and student_id = $2',
      [req.body.class_id, req.body.student_id],
    );
    if (!enrolled.rowCount) throw new AppError(400, 'Student is not enrolled in the report class');
  }
  if (req.body.parent_id) {
    const linked = await pool.query(
      'select 1 from student_parents where parent_id = $1 and student_id = $2',
      [req.body.parent_id, req.body.student_id],
    );
    if (!linked.rowCount) throw new AppError(400, 'Parent is not linked to the report student');
  }
  const values = pick(req.body, [
    'student_id', 'class_id', 'teacher_id', 'parent_id', 'report_title', 'period_start', 'period_end',
    'homework_summary', 'attendance_summary', 'strength_summary', 'weakness_summary',
    'teacher_recommendation', 'parent_note', 'status', 'sent_at',
  ]);
  if (req.user.role === 'teacher') values.teacher_id = req.user.teacher_id;
  const result = await pool.query(buildInsert('progress_reports', values));
  return success(res, result.rows[0], 'Progress report created successfully', 201);
});

async function getWritableReport(reportId, user) {
  const result = await pool.query('select * from progress_reports where report_id = $1', [reportId]);
  if (!result.rowCount) throw new AppError(404, 'Progress report not found');
  if (result.rows[0].class_id) await assertTeacherReportClass(user, result.rows[0].class_id);
  else if (!['admin', 'staff'].includes(user.role)) throw new AppError(403, 'You cannot edit this report');
  return result.rows[0];
}

const updateReport = asyncHandler(async (req, res) => {
  await getWritableReport(req.params.reportId, req.user);
  const result = await pool.query(buildUpdate('progress_reports', 'report_id', req.params.reportId, pick(req.body, [
    'student_id', 'class_id', 'teacher_id', 'parent_id', 'report_title', 'period_start', 'period_end',
    'homework_summary', 'attendance_summary', 'strength_summary', 'weakness_summary',
    'teacher_recommendation', 'parent_note', 'status', 'sent_at',
  ])));
  return success(res, result.rows[0], 'Progress report updated successfully');
});

const deleteReport = asyncHandler(async (req, res) => {
  await getWritableReport(req.params.reportId, req.user);
  const result = await pool.query('delete from progress_reports where report_id = $1 returning report_id', [req.params.reportId]);
  return success(res, result.rows[0], 'Progress report deleted successfully');
});

const getWeakTopics = asyncHandler(async (req, res) => {
  const values = [];
  const where = [];
  if (req.query.student_id) { values.push(req.query.student_id); where.push(`student_id = $${values.length}`); }
  if (req.query.class_id) { values.push(req.query.class_id); where.push(`class_id = $${values.length}`); }
  if (req.user.role === 'teacher') {
    values.push(req.user.teacher_id);
    where.push(`class_id in (select class_id from classes where teacher_id = $${values.length})`);
  }
  const result = await pool.query(`select * from v_student_weak_topics ${where.length ? `where ${where.join(' and ')}` : ''} order by mastery_percent`, values);
  return success(res, result.rows, 'Weak topics fetched successfully');
});

const getStudentWeakTopics = asyncHandler(async (req, res) => {
  await assertStudentVisibility(req.user, req.params.studentId);
  const result = await pool.query('select * from v_student_weak_topics where student_id = $1 order by mastery_percent', [req.params.studentId]);
  return success(res, result.rows, 'Student weak topics fetched successfully');
});

const getAssignmentSummary = asyncHandler(async (req, res) => {
  await assertStudentVisibility(req.user, req.params.studentId);
  const result = await pool.query('select * from v_student_assignment_summary where student_id = $1 order by assignment_id desc', [req.params.studentId]);
  return success(res, result.rows, 'Assignment summary fetched successfully');
});

const getClassPerformance = asyncHandler(async (req, res) => {
  await assertTeacherReportClass(req.user, req.params.classId);
  const result = await pool.query('select * from v_student_topic_performance where class_id = $1 order by student_name, mastery_percent', [req.params.classId]);
  return success(res, result.rows, 'Class performance fetched successfully');
});

const getLearningHistoryAlerts = asyncHandler(async (req, res) => {
  const values = [];
  let teacherScope = '';
  if (req.user.role === 'teacher') {
    values.push(req.user.teacher_id);
    teacherScope = `and (pr.teacher_id = $1 or pr.class_id in (select class_id from classes where teacher_id = $1))`;
  }
  const result = await pool.query(
    `select pr.*, s.student_code, s.full_name as student_name,
            c.class_code, c.class_name, t.full_name as teacher_name,
            (select count(*)::int from student_learning_events e
             where e.student_id = pr.student_id and e.category_key = pr.source_key) as occurrence_count
     from progress_reports pr
     join students s on s.student_id = pr.student_id
     left join classes c on c.class_id = pr.class_id
     left join teachers t on t.teacher_id = pr.teacher_id
     where pr.report_source = 'learning_history' ${teacherScope}
     order by pr.created_at desc`,
    values,
  );
  return success(res, result.rows, 'Learning history alerts fetched successfully');
});

module.exports = {
  getStudentReports, createReport, updateReport, deleteReport,
  getWeakTopics, getStudentWeakTopics, getAssignmentSummary, getClassPerformance,
  getLearningHistoryAlerts,
};
