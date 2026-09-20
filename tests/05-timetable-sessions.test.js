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
  const runner = createSuiteRunner('Suite 05: Schedules, Sessions, Timetable & Attendance');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  let testClassId = null;
  let testScheduleId = null;
  let testSessionId = null;
  let testStudentId = null;
  const timestamp = Date.now();

  // Setup: create test student
  const studentRes = await api('POST', '/api/students', {
    token: tokens.admin,
    body: {
      full_name: `Timetable Student ${timestamp}`,
      phone: `0944${timestamp.toString().slice(-6)}`,
      gender: 'male',
    },
  });
  if (studentRes.status === 201) testStudentId = studentRes.data.data.student_id;

  // Setup: create test class (start_date and end_date near current date)
  const today = new Date();
  const startDate = today.toISOString().split('T')[0];
  const endDateObj = new Date(today.getTime() + 14 * 86400000); // 2 weeks
  const endDate = endDateObj.toISOString().split('T')[0];

  const subRes = await api('GET', '/api/subjects', { token: tokens.admin });
  const subjectId = subRes.data?.data?.[0]?.subject_id || 1;

  const classRes = await api('POST', '/api/classes', {
    token: tokens.admin,
    body: {
      class_name: `Timetable Class ${timestamp}`,
      subject_id: subjectId,
      grade_level: 'Grade 10',
      max_students: 30,
      tuition_fee: 600000,
      start_date: startDate,
      end_date: endDate,
    },
  });
  if (classRes.status === 201) testClassId = classRes.data.data.class_id;

  // Enroll student into class
  if (testClassId && testStudentId) {
    await api('POST', `/api/classes/${testClassId}/enroll/${testStudentId}`, {
      token: tokens.admin,
      body: { status: 'studying' },
    });
  }

  // --- 1. SCHEDULES ---
  await runner.test('Schedules: POST /api/classes/:classId/schedules creates a recurring schedule', async () => {
    assert.ok(testClassId, 'Test class required');
    const res = await api('POST', `/api/classes/${testClassId}/schedules`, {
      token: tokens.admin,
      body: {
        day_of_week: 'tuesday',
        start_time: '18:00',
        end_time: '19:30',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.schedule_id);
    testScheduleId = res.data.data.schedule_id;
  });

  // --- 2. SESSIONS GENERATION ---
  await runner.test('Sessions: POST /api/classes/:classId/generate-sessions generates session rows', async () => {
    assert.ok(testClassId, 'Test class required');
    const res = await api('POST', `/api/classes/${testClassId}/generate-sessions`, {
      token: tokens.admin,
      body: {
        from_date: startDate,
        to_date: endDate,
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
  });

  await runner.test('Sessions: GET /api/classes/:classId/sessions lists generated sessions', async () => {
    const res = await api('GET', `/api/classes/${testClassId}/sessions`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    const sessions = getList(res);
    assert.ok(Array.isArray(sessions));
    if (sessions.length > 0) {
      testSessionId = sessions[0].session_id;
    }
  });

  await runner.test('Sessions: PUT /api/sessions/:sessionId updates session topic/status', async () => {
    if (!testSessionId) {
      // Create an ad-hoc session if none generated
      const createRes = await api('POST', `/api/classes/${testClassId}/sessions`, {
        token: tokens.admin,
        body: {
          session_date: startDate,
          start_time: '18:00',
          end_time: '19:30',
          status: 'scheduled',
        },
      });
      if (createRes.status === 201) testSessionId = createRes.data.data.session_id;
    }
    assert.ok(testSessionId, 'Test session required');

    const res = await api('PUT', `/api/sessions/${testSessionId}`, {
      token: tokens.admin,
      body: {
        topic: 'Introduction to Mechanics & Vectors',
        status: 'completed',
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  // --- 3. TIMETABLE QUERIES ---
  await runner.test('Timetable: GET /api/timetable returns system calendar events', async () => {
    const res = await api('GET', '/api/timetable', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
  });

  await runner.test('Timetable: GET /api/timetable/class/:classId returns class schedule', async () => {
    const res = await api('GET', `/api/timetable/class/${testClassId}`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
  });

  // --- 4. ATTENDANCE ---
  await runner.test('Attendance: POST /api/sessions/:sessionId/attendance records student attendance', async () => {
    assert.ok(testSessionId && testStudentId, 'Session and Student required');
    const res = await api('POST', `/api/sessions/${testSessionId}/attendance`, {
      token: tokens.admin,
      body: {
        attendance: [
          {
            student_id: testStudentId,
            status: 'present',
            note: 'Attended on time and participated actively',
          },
        ],
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
  });

  await runner.test('Attendance: GET /api/sessions/:sessionId/attendance returns saved records', async () => {
    const res = await api('GET', `/api/sessions/${testSessionId}/attendance`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    const records = getList(res);
    assert.ok(Array.isArray(records));
    const record = records.find((a) => a.student_id === testStudentId);
    assert.ok(record, 'Student attendance must be recorded');
    assert.strictEqual(record.status, 'present');
  });

  await runner.test('Attendance: GET /api/classes/:classId/attendance-history returns class attendance', async () => {
    const res = await api('GET', `/api/classes/${testClassId}/attendance-history`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
  });

  // Cleanup
  try {
    if (testSessionId) await api('DELETE', `/api/sessions/${testSessionId}`, { token: tokens.admin });
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
