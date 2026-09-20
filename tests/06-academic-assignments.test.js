const assert = require('assert');
const {
  setupTestEnvironment,
  teardownTestEnvironment,
  getAuthTokens,
  api,
  getList,
  createSuiteRunner,
} = require('./helpers/test-env');

async function run() {
  await setupTestEnvironment();
  const tokens = await getAuthTokens();
  const runner = createSuiteRunner('Suite 06: Academic Topics, Assignments, Questions & Submissions');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  let testTopicId = null;
  let testClassId = null;
  let testAssignmentId = null;
  let testQuestionId = null;
  let testSubmissionId = null;
  let testStudentId = null;
  const timestamp = Date.now();

  // Setup: create test student
  const studentRes = await api('POST', '/api/students', {
    token: tokens.admin,
    body: {
      full_name: `Academic Student ${timestamp}`,
      gender: 'male',
      phone: `0966${timestamp.toString().slice(-6)}`,
    },
  });
  if (studentRes.status === 201) testStudentId = studentRes.data.data.student_id;

  // Setup: get or create class
  const subRes = await api('GET', '/api/subjects', { token: tokens.admin });
  const subjectId = subRes.data?.data?.[0]?.subject_id || 1;

  const classRes = await api('POST', '/api/classes', {
    token: tokens.admin,
    body: {
      class_name: `Academic Test Class ${timestamp}`,
      subject_id: subjectId,
      grade_level: 'Grade 11',
      max_students: 30,
      tuition_fee: 750000,
    },
  });
  if (classRes.status === 201) testClassId = classRes.data.data.class_id;

  // Enroll student
  if (testClassId && testStudentId) {
    await api('POST', `/api/classes/${testClassId}/enroll/${testStudentId}`, {
      token: tokens.admin,
      body: { status: 'studying' },
    });
  }

  // --- 1. LEARNING TOPICS ---
  await runner.test('Topics: GET /api/topics lists academic topics', async () => {
    const res = await api('GET', '/api/topics', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(getList(res)));
  });

  await runner.test('Topics: POST /api/topics creates a new learning topic', async () => {
    const res = await api('POST', '/api/topics', {
      token: tokens.admin,
      body: {
        subject_id: subjectId,
        topic_name: `Electromagnetism Basics ${timestamp}`,
        description: 'Introduction to Faraday Law and Induction',
        difficulty_level: 'medium',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.topic_id);
    testTopicId = res.data.data.topic_id;
  });

  await runner.test('Topics: PUT /api/topics/:topicId updates difficulty and description', async () => {
    assert.ok(testTopicId, 'Topic required');
    const res = await api('PUT', `/api/topics/${testTopicId}`, {
      token: tokens.admin,
      body: { difficulty_level: 'hard' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.difficulty_level, 'hard');
  });

  // --- 2. ASSIGNMENTS ---
  await runner.test('Assignments: POST /api/classes/:classId/assignments creates an assignment', async () => {
    assert.ok(testClassId, 'Class required');
    const res = await api('POST', `/api/classes/${testClassId}/assignments`, {
      token: tokens.admin,
      body: {
        title: `Homework Assignment ${timestamp}`,
        description: 'Complete all 3 questions and upload solutions',
        assigned_date: '2026-06-01',
        due_date: '2026-06-15',
        total_score: 10,
        status: 'assigned',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.assignment_id);
    testAssignmentId = res.data.data.assignment_id;
  });

  await runner.test('Assignments: GET /api/classes/:classId/assignments lists class assignments', async () => {
    const res = await api('GET', `/api/classes/${testClassId}/assignments`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
    const found = getList(res).find((a) => a.assignment_id === testAssignmentId);
    assert.ok(found, 'Created assignment must be listed');
  });

  await runner.test('Assignments: GET /api/assignments/:id retrieves assignment details', async () => {
    const res = await api('GET', `/api/assignments/${testAssignmentId}`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.assignment_id, testAssignmentId);
  });

  // --- 3. QUESTIONS ---
  await runner.test('Questions: POST /api/assignments/:id/questions adds question to assignment', async () => {
    assert.ok(testAssignmentId, 'Assignment required');
    const res = await api('POST', `/api/assignments/${testAssignmentId}/questions`, {
      token: tokens.admin,
      body: {
        topic_id: testTopicId,
        question_no: 1,
        question_text: 'What is magnetic flux?',
        question_type: 'short_answer',
        difficulty_level: 'medium',
        max_score: 5,
        correct_answer: 'Flux = B * A * cos(theta)',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.question_id);
    testQuestionId = res.data.data.question_id;
  });

  await runner.test('Questions: GET /api/assignments/:id/questions lists questions', async () => {
    const res = await api('GET', `/api/assignments/${testAssignmentId}/questions`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
    assert.strictEqual(getList(res).length, 1);
  });

  // --- 4. SUBMISSIONS & ANSWERS ---
  await runner.test('Submissions: POST /api/assignments/:id/submissions creates student submission', async () => {
    assert.ok(testAssignmentId && testStudentId, 'Assignment and student required');
    const res = await api('POST', `/api/assignments/${testAssignmentId}/submissions`, {
      token: tokens.admin,
      body: {
        student_id: testStudentId,
        status: 'submitted',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.submission_id);
    testSubmissionId = res.data.data.submission_id;
  });

  await runner.test('Answers: POST /api/submissions/:id/answers saves student answer and grade', async () => {
    assert.ok(testSubmissionId && testQuestionId, 'Submission and question required');
    const res = await api('POST', `/api/submissions/${testSubmissionId}/answers`, {
      token: tokens.admin,
      body: {
        question_id: testQuestionId,
        student_answer: 'Flux = B * A * cos(theta)',
        score: 5,
        is_correct: true,
        teacher_comment: 'Excellent understanding of magnetic flux formula',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.is_correct, true);
    assert.strictEqual(Number(res.data.data.score), 5);
  });

  await runner.test('Submissions: GET /api/students/:id/submissions lists student submissions', async () => {
    const res = await api('GET', `/api/students/${testStudentId}/submissions`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
  });

  // Cleanup
  try {
    if (testAssignmentId) await api('DELETE', `/api/assignments/${testAssignmentId}`, { token: tokens.admin });
    if (testTopicId) await api('DELETE', `/api/topics/${testTopicId}`, { token: tokens.admin });
    if (testClassId) await api('DELETE', `/api/classes/${testClassId}`, { token: tokens.admin });
    if (testStudentId) await api('DELETE', `/api/students/${testStudentId}`, { token: tokens.admin });
  } catch (err) {}

  const summary = runner.summary();
  if (require.main === module) {
    await teardownTestEnvironment(true);
    process.exitCode = summary.failed > 0 ? 1 : 0;
  }
  return summary;
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = run;
