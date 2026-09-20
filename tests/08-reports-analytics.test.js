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
  const runner = createSuiteRunner('Suite 08: Reports, Progress Tracking & Academic Analytics');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  let testReportId = null;
  const timestamp = Date.now();

  // --- 1. WEAK TOPICS ANALYTICS ---
  await runner.test('Reports: GET /api/reports/weak-topics queries weak topics view', async () => {
    const res = await api('GET', '/api/reports/weak-topics', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(getList(res)));
  });

  await runner.test('Reports: GET /api/reports/student/1/weak-topics queries specific student weak topics', async () => {
    const res = await api('GET', '/api/reports/student/1/weak-topics', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
  });

  // --- 2. ASSIGNMENT SUMMARY ---
  await runner.test('Reports: GET /api/reports/student/1/assignment-summary returns student summary', async () => {
    const res = await api('GET', '/api/reports/student/1/assignment-summary', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
  });

  // --- 3. CLASS PERFORMANCE ---
  await runner.test('Reports: GET /api/reports/class/:id/performance returns class performance stats', async () => {
    const classesRes = await api('GET', '/api/classes?limit=1', { token: tokens.admin });
    const classList = getList(classesRes);
    let classId = classList[0]?.class_id;

    if (!classId) {
      const subRes = await api('GET', '/api/subjects?limit=1', { token: tokens.admin });
      const subjectId = getList(subRes)[0]?.subject_id || 1;
      const newClassRes = await api('POST', '/api/classes', {
        token: tokens.admin,
        body: { class_name: `Report Class ${timestamp}`, subject_id: subjectId, max_students: 20 },
      });
      classId = newClassRes.data?.data?.class_id;
    }

    assert.ok(classId, 'Class ID required');
    const res = await api('GET', `/api/reports/class/${classId}/performance`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(getList(res)));
  });

  // --- 4. PROGRESS REPORTS CRUD ---
  await runner.test('Reports: POST /api/reports creates student monthly progress report', async () => {
    const res = await api('POST', '/api/reports', {
      token: tokens.admin,
      body: {
        student_id: 1,
        report_title: `Progress Report Automation ${timestamp}`,
        period_start: '2026-06-01',
        period_end: '2026-06-30',
        homework_summary: 'Completed 90% of homework tasks with high accuracy',
        attendance_summary: 'Attended 100% of sessions',
        strength_summary: 'Good analytical skills and fast calculation',
        weakness_summary: 'Needs improvement in word problem formulation',
        teacher_recommendation: 'Practice 5 word problems daily',
        status: 'draft',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.report_id);
    testReportId = res.data.data.report_id;
  });

  await runner.test('Reports: GET /api/reports/student/1 retrieves list of student progress reports', async () => {
    const res = await api('GET', '/api/reports/student/1', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
    const found = getList(res).find((r) => r.report_id === testReportId);
    assert.ok(found, 'Created progress report must be found');
  });

  await runner.test('Reports: PUT /api/reports/:id updates status to sent', async () => {
    assert.ok(testReportId, 'Report required');
    const res = await api('PUT', `/api/reports/${testReportId}`, {
      token: tokens.admin,
      body: { status: 'sent' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.status, 'sent');
  });

  await runner.test('Reports: DELETE /api/reports/:id deletes progress report', async () => {
    assert.ok(testReportId, 'Report required');
    const res = await api('DELETE', `/api/reports/${testReportId}`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
  });

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
