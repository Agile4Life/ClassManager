const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { pick, buildInsert, buildUpdate } = require('../utils/query');
const { success } = require('../utils/response');
const { assertTeacherClassAccess: assertTeacherOwnsClass } = require('../utils/access');

async function getAssignment(id) {
  const result = await pool.query(
    `select a.*
     from assignments a
     join classes c on c.class_id = a.class_id and c.status <> 'cancelled'
     where a.assignment_id = $1`,
    [id],
  );
  if (!result.rowCount) throw new AppError(404, 'Assignment not found');
  return result.rows[0];
}

async function assertAssignmentVisibility(user, assignment) {
  if (['admin', 'staff'].includes(user.role)) return;
  if (user.role === 'teacher') return assertTeacherOwnsClass(user, assignment.class_id);
  if (user.role === 'student') {
    if (assignment.status !== 'assigned') throw new AppError(403, 'This assignment is not available');
    const enrolled = await pool.query(
      'select 1 from enrollments where class_id = $1 and student_id = $2',
      [assignment.class_id, user.student_id],
    );
    if (enrolled.rowCount) return;
  }
  throw new AppError(403, 'You do not have access to this assignment');
}

function hideAnswersForStudent(rows, user) {
  if (user.role !== 'student') return rows;
  return rows.map(({ correct_answer: ignored, ...question }) => question);
}

const listTopics = asyncHandler(async (req, res) => {
  const values = [];
  const conditions = [];
  for (const field of ['subject_id', 'status', 'difficulty_level']) {
    if (req.query[field] !== undefined) {
      values.push(req.query[field]); conditions.push(`lt.${field} = $${values.length}`);
    }
  }
  const result = await pool.query(
    `select lt.*, s.subject_code, s.subject_name from learning_topics lt
     join subjects s on s.subject_id = lt.subject_id
     ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
     order by s.subject_name, lt.topic_name`, values,
  );
  return success(res, result.rows, 'Learning topics fetched successfully');
});

const createTopic = asyncHandler(async (req, res) => {
  if (!req.body.subject_id || !req.body.topic_name) throw new AppError(400, 'subject_id and topic_name are required');
  const result = await pool.query(buildInsert('learning_topics', pick(req.body, ['subject_id', 'topic_name', 'description', 'difficulty_level', 'status'])));
  return success(res, result.rows[0], 'Learning topic created successfully', 201);
});

const updateTopic = asyncHandler(async (req, res) => {
  const result = await pool.query(buildUpdate('learning_topics', 'topic_id', req.params.topicId, pick(req.body, ['subject_id', 'topic_name', 'description', 'difficulty_level', 'status'])));
  if (!result.rowCount) throw new AppError(404, 'Learning topic not found');
  return success(res, result.rows[0], 'Learning topic updated successfully');
});

const deleteTopic = asyncHandler(async (req, res) => {
  const result = await pool.query('delete from learning_topics where topic_id = $1 returning topic_id', [req.params.topicId]);
  if (!result.rowCount) throw new AppError(404, 'Learning topic not found');
  return success(res, result.rows[0], 'Learning topic deleted successfully');
});

const listClassAssignments = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') await assertTeacherOwnsClass(req.user, req.params.classId);
  if (req.user.role === 'student') {
    const enrolled = await pool.query(
      `select 1
       from enrollments e
       join classes c on c.class_id = e.class_id and c.status <> 'cancelled'
       where e.class_id = $1 and e.student_id = $2`,
      [req.params.classId, req.user.student_id],
    );
    if (!enrolled.rowCount) throw new AppError(403, 'You are not enrolled in this class');
  }
  const result = await pool.query(
    `select * from assignments where class_id = $1 ${req.user.role === 'student' ? "and status = 'assigned'" : ''}
     order by assigned_date desc, assignment_id desc`,
    [req.params.classId],
  );
  return success(res, result.rows, 'Assignments fetched successfully');
});

const createAssignment = asyncHandler(async (req, res) => {
  await assertTeacherOwnsClass(req.user, req.params.classId);
  if (!req.body.title) throw new AppError(400, 'title is required');
  const teacherId = req.user.role === 'teacher' ? req.user.teacher_id : (req.body.teacher_id || null);
  const result = await pool.query(
    `insert into assignments (class_id, teacher_id, title, description, assigned_date, due_date, total_score, status)
     values ($1, $2, $3, $4, coalesce($5::date, current_date), $6, coalesce($7, 10), coalesce($8, 'assigned')) returning *`,
    [req.params.classId, teacherId, req.body.title, req.body.description || null, req.body.assigned_date || null,
      req.body.due_date || null, req.body.total_score || null, req.body.status || null],
  );
  return success(res, result.rows[0], 'Assignment created successfully', 201);
});

const getAssignmentById = asyncHandler(async (req, res) => {
  const assignment = await getAssignment(req.params.assignmentId);
  await assertAssignmentVisibility(req.user, assignment);
  const questions = await pool.query(
    `select aq.*, lt.topic_name from assignment_questions aq
     left join learning_topics lt on lt.topic_id = aq.topic_id
     where aq.assignment_id = $1 order by aq.question_no`, [assignment.assignment_id],
  );
  return success(res, { ...assignment, questions: hideAnswersForStudent(questions.rows, req.user) }, 'Assignment fetched successfully');
});

const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await getAssignment(req.params.assignmentId);
  await assertTeacherOwnsClass(req.user, assignment.class_id);
  const result = await pool.query(buildUpdate('assignments', 'assignment_id', assignment.assignment_id,
    pick(req.body, ['teacher_id', 'title', 'description', 'assigned_date', 'due_date', 'total_score', 'status'])));
  return success(res, result.rows[0], 'Assignment updated successfully');
});

const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await getAssignment(req.params.assignmentId);
  await assertTeacherOwnsClass(req.user, assignment.class_id);
  const result = await pool.query('delete from assignments where assignment_id = $1 returning assignment_id', [assignment.assignment_id]);
  return success(res, result.rows[0], 'Assignment deleted successfully');
});

const listQuestions = asyncHandler(async (req, res) => {
  const assignment = await getAssignment(req.params.assignmentId);
  await assertAssignmentVisibility(req.user, assignment);
  const result = await pool.query(
    `select aq.*, lt.topic_name from assignment_questions aq
     left join learning_topics lt on lt.topic_id = aq.topic_id
     where aq.assignment_id = $1 order by aq.question_no`, [req.params.assignmentId],
  );
  return success(res, hideAnswersForStudent(result.rows, req.user), 'Assignment questions fetched successfully');
});

const createQuestion = asyncHandler(async (req, res) => {
  const assignment = await getAssignment(req.params.assignmentId);
  await assertTeacherOwnsClass(req.user, assignment.class_id);
  if (!req.body.topic_id || !req.body.question_no || !req.body.question_text) {
    throw new AppError(400, 'topic_id, question_no and question_text are required');
  }
  const topic = await pool.query(
    `select 1 from learning_topics lt join classes c on c.subject_id = lt.subject_id
     where lt.topic_id = $1 and c.class_id = $2`, [req.body.topic_id, assignment.class_id],
  );
  if (!topic.rowCount) throw new AppError(400, 'Topic must belong to the assignment class subject');
  const values = { assignment_id: assignment.assignment_id, ...pick(req.body, ['topic_id', 'question_no', 'question_text', 'question_type', 'difficulty_level', 'max_score', 'correct_answer']) };
  const result = await pool.query(buildInsert('assignment_questions', values));
  return success(res, result.rows[0], 'Question created successfully', 201);
});

async function getQuestionForTeacher(questionId, user) {
  const result = await pool.query(
    `select aq.*, a.class_id from assignment_questions aq join assignments a on a.assignment_id = aq.assignment_id
     where aq.question_id = $1`, [questionId],
  );
  if (!result.rowCount) throw new AppError(404, 'Question not found');
  await assertTeacherOwnsClass(user, result.rows[0].class_id);
  return result.rows[0];
}

const updateQuestion = asyncHandler(async (req, res) => {
  await getQuestionForTeacher(req.params.questionId, req.user);
  const result = await pool.query(buildUpdate('assignment_questions', 'question_id', req.params.questionId,
    pick(req.body, ['topic_id', 'question_no', 'question_text', 'question_type', 'difficulty_level', 'max_score', 'correct_answer'])));
  return success(res, result.rows[0], 'Question updated successfully');
});

const deleteQuestion = asyncHandler(async (req, res) => {
  await getQuestionForTeacher(req.params.questionId, req.user);
  const result = await pool.query('delete from assignment_questions where question_id = $1 returning question_id', [req.params.questionId]);
  return success(res, result.rows[0], 'Question deleted successfully');
});

const listSubmissions = asyncHandler(async (req, res) => {
  const assignment = await getAssignment(req.params.assignmentId);
  await assertTeacherOwnsClass(req.user, assignment.class_id);
  const result = await pool.query(
    `select sub.*, s.student_code, s.full_name as student_name from assignment_submissions sub
     join students s on s.student_id = sub.student_id
     where sub.assignment_id = $1 order by s.full_name`, [assignment.assignment_id],
  );
  return success(res, result.rows, 'Submissions fetched successfully');
});

const createSubmission = asyncHandler(async (req, res) => {
  const assignment = await getAssignment(req.params.assignmentId);
  if (req.user.role === 'student' && assignment.status !== 'assigned') throw new AppError(409, 'This assignment is not open for submission');
  const studentId = req.user.role === 'student' ? req.user.student_id : req.body.student_id;
  if (!studentId) throw new AppError(400, 'student_id is required');
  if (req.user.role === 'teacher') await assertTeacherOwnsClass(req.user, assignment.class_id);
  const enrolled = await pool.query('select 1 from enrollments where class_id = $1 and student_id = $2', [assignment.class_id, studentId]);
  if (!enrolled.rowCount) throw new AppError(400, 'Student is not enrolled in the assignment class');
  const canGrade = ['admin', 'staff', 'teacher'].includes(req.user.role);
  const status = canGrade ? (req.body.status || 'submitted') : 'submitted';
  const submittedAt = canGrade ? (req.body.submitted_at || null) : null;
  const result = await pool.query(
    `insert into assignment_submissions
       (assignment_id, student_id, submitted_at, status, total_score, teacher_feedback, graded_at)
     values ($1, $2, coalesce($3::timestamptz, now()), $4, $5, $6, $7)
     on conflict (assignment_id, student_id) do update set
       submitted_at = excluded.submitted_at, status = excluded.status,
       total_score = case when $8 then excluded.total_score else assignment_submissions.total_score end,
       teacher_feedback = case when $8 then excluded.teacher_feedback else assignment_submissions.teacher_feedback end,
       graded_at = case when $8 then excluded.graded_at else assignment_submissions.graded_at end
     where $8 or assignment_submissions.status <> 'graded'
     returning *`,
    [assignment.assignment_id, studentId, submittedAt, status,
      canGrade ? (req.body.total_score ?? 0) : 0,
      canGrade ? (req.body.teacher_feedback || null) : null,
      canGrade ? (req.body.graded_at || null) : null, canGrade],
  );
  if (!result.rowCount) throw new AppError(409, 'A graded submission cannot be resubmitted');
  return success(res, result.rows[0], 'Submission saved successfully', 201);
});

const listStudentSubmissions = asyncHandler(async (req, res) => {
  if (req.user.role === 'student' && String(req.user.student_id) !== String(req.params.studentId)) throw new AppError(403, 'You can only view your own submissions');
  if (req.user.role === 'teacher') {
    const visible = await pool.query(
      `select 1 from enrollments e join classes c on c.class_id = e.class_id
       where e.student_id = $1 and c.teacher_id = $2 and c.status <> 'cancelled' limit 1`,
      [req.params.studentId, req.user.teacher_id],
    );
    if (!visible.rowCount) throw new AppError(403, 'This student is not in one of your classes');
  }
  const result = await pool.query(
    `select sub.submission_id, s.student_id, s.student_code, s.full_name as student_name,
            c.class_id, c.class_name, a.assignment_id, a.title as assignment_title,
            a.total_score as assignment_total_score, sub.status as submission_status,
            sub.total_score as student_score,
            round(case when a.total_score = 0 then 0
                       else (sub.total_score / a.total_score) * 100 end, 2) as score_percent,
            sub.teacher_feedback, sub.submitted_at, sub.graded_at
     from assignment_submissions sub
     join students s on s.student_id = sub.student_id
     join assignments a on a.assignment_id = sub.assignment_id
     join classes c on c.class_id = a.class_id and c.status <> 'cancelled'
     where sub.student_id = $1 order by a.assignment_id desc`, [req.params.studentId],
  );
  return success(res, result.rows, 'Student submissions fetched successfully');
});

async function getSubmission(submissionId) {
  const result = await pool.query(
    `select sub.*, a.class_id from assignment_submissions sub
     join assignments a on a.assignment_id = sub.assignment_id
     join classes c on c.class_id = a.class_id and c.status <> 'cancelled'
     where sub.submission_id = $1`, [submissionId],
  );
  if (!result.rowCount) throw new AppError(404, 'Submission not found');
  return result.rows[0];
}

const saveAnswer = asyncHandler(async (req, res) => {
  const submission = await getSubmission(req.params.submissionId);
  const isOwner = req.user.role === 'student' && String(req.user.student_id) === String(submission.student_id);
  const canGrade = ['admin', 'staff', 'teacher'].includes(req.user.role);
  if (!isOwner && !canGrade) throw new AppError(403, 'You do not have access to this submission');
  if (isOwner && submission.status === 'graded') throw new AppError(409, 'A graded submission cannot be changed');
  if (req.user.role === 'teacher') await assertTeacherOwnsClass(req.user, submission.class_id);
  if (!req.body.question_id) throw new AppError(400, 'question_id is required');
  const question = await pool.query('select 1 from assignment_questions where question_id = $1 and assignment_id = $2', [req.body.question_id, submission.assignment_id]);
  if (!question.rowCount) throw new AppError(400, 'Question does not belong to this submission assignment');
  const result = await pool.query(
    `insert into student_answers (submission_id, question_id, student_answer, score, is_correct, teacher_comment)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (submission_id, question_id) do update set
       student_answer = excluded.student_answer,
       score = case when $7 then excluded.score else student_answers.score end,
       is_correct = case when $7 then excluded.is_correct else student_answers.is_correct end,
       teacher_comment = case when $7 then excluded.teacher_comment else student_answers.teacher_comment end
     returning *`,
    [submission.submission_id, req.body.question_id, req.body.student_answer || null,
      canGrade ? (req.body.score ?? 0) : 0, canGrade ? (req.body.is_correct ?? null) : null,
      canGrade ? (req.body.teacher_comment || null) : null, canGrade],
  );
  return success(res, result.rows[0], 'Answer saved successfully', 201);
});

const updateAnswer = asyncHandler(async (req, res) => {
  const existing = await pool.query(
    `select sa.answer_id, sub.student_id, sub.status as submission_status, a.class_id from student_answers sa
     join assignment_submissions sub on sub.submission_id = sa.submission_id
     join assignments a on a.assignment_id = sub.assignment_id where sa.answer_id = $1`, [req.params.answerId],
  );
  if (!existing.rowCount) throw new AppError(404, 'Answer not found');
  const row = existing.rows[0];
  const isOwner = req.user.role === 'student' && String(req.user.student_id) === String(row.student_id);
  const canGrade = ['admin', 'staff', 'teacher'].includes(req.user.role);
  if (!isOwner && !canGrade) throw new AppError(403, 'You do not have access to this answer');
  if (isOwner && row.submission_status === 'graded') throw new AppError(409, 'A graded submission cannot be changed');
  if (req.user.role === 'teacher') await assertTeacherOwnsClass(req.user, row.class_id);
  const allowed = canGrade ? ['student_answer', 'score', 'is_correct', 'teacher_comment'] : ['student_answer'];
  const result = await pool.query(buildUpdate('student_answers', 'answer_id', req.params.answerId, pick(req.body, allowed)));
  return success(res, result.rows[0], 'Answer updated successfully');
});

module.exports = {
  listTopics, createTopic, updateTopic, deleteTopic,
  listClassAssignments, createAssignment, getAssignmentById, updateAssignment, deleteAssignment,
  listQuestions, createQuestion, updateQuestion, deleteQuestion,
  listSubmissions, createSubmission, listStudentSubmissions, saveAnswer, updateAnswer,
};
