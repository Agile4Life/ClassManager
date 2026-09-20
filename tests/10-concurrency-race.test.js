const assert = require('assert');
const {
  setupTestEnvironment,
  teardownTestEnvironment,
  getAuthTokens,
  api,
  getList,
  pool,
  createSuiteRunner,
} = require('./helpers/test-env');

async function run() {
  await setupTestEnvironment();
  const tokens = await getAuthTokens();
  const runner = createSuiteRunner('Suite 10: Concurrency, Race Conditions & Stress Testing');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  const timestamp = Date.now();

  // --- 1. RACE CONDITION: CONCURRENT ENROLLMENT OVERBOOKING DEFENSE ---
  await runner.test('Concurrency: Exactly 1 student enrolls when only 1 seat remains (Overbooking Defense)', async () => {
    // 1. Create a class with max_students: 1
    const subRes = await api('GET', '/api/subjects', { token: tokens.admin });
    const subjects = getList(subRes);
    const subjectId = subjects.length > 0 ? subjects[0].subject_id : 1;

    const classRes = await api('POST', '/api/classes', {
      token: tokens.admin,
      body: {
        class_name: `Race Condition Class ${timestamp}`,
        subject_id: subjectId,
        max_students: 1, // Strictly 1 seat!
        tuition_fee: 500000,
      },
    });
    assert.strictEqual(classRes.status, 201);
    const classId = classRes.data.data.class_id;

    // 2. Create 2 test students
    const s1Res = await api('POST', '/api/students', {
      token: tokens.admin,
      body: {
        full_name: `Race Student 1 - ${timestamp}`,
        gender: 'male',
        phone: `0981${timestamp.toString().slice(-6)}`,
      },
    });
    assert.strictEqual(s1Res.status, 201);
    const s1Id = s1Res.data.data.student_id;

    const s2Res = await api('POST', '/api/students', {
      token: tokens.admin,
      body: {
        full_name: `Race Student 2 - ${timestamp}`,
        gender: 'female',
        phone: `0982${timestamp.toString().slice(-6)}`,
      },
    });
    assert.strictEqual(s2Res.status, 201);
    const s2Id = s2Res.data.data.student_id;

    // 3. Fire both enrollment requests SIMULTANEOUSLY via Promise.all
    const [res1, res2] = await Promise.all([
      api('POST', `/api/classes/${classId}/enroll/${s1Id}`, {
        token: tokens.admin,
        body: { status: 'studying', note: 'Concurrent attempt 1' },
      }),
      api('POST', `/api/classes/${classId}/enroll/${s2Id}`, {
        token: tokens.admin,
        body: { status: 'studying', note: 'Concurrent attempt 2' },
      }),
    ]);

    // 4. Analyze HTTP status codes
    const statuses = [res1.status, res2.status].sort();
    assert.strictEqual(
      statuses[0],
      201,
      `Expected one enrollment to succeed with 201, got ${statuses[0]}`,
    );
    assert.strictEqual(
      statuses[1],
      409,
      `Expected the other enrollment to receive 409 Conflict, got ${statuses[1]}`,
    );

    // 5. Query DB directly to verify total count of enrolled students is strictly 1
    const dbCheck = await pool.query(
      `select count(*)::int as count from enrollments where class_id = $1 and status = 'studying'`,
      [classId],
    );
    assert.strictEqual(
      dbCheck.rows[0].count,
      1,
      `Database integrity check failed: expected 1 enrolled student, found ${dbCheck.rows[0].count}`,
    );

    // Cleanup
    await api('DELETE', `/api/classes/${classId}`, { token: tokens.admin });
    await api('DELETE', `/api/students/${s1Id}`, { token: tokens.admin });
    await api('DELETE', `/api/students/${s2Id}`, { token: tokens.admin });
  });

  // --- 2. CONCURRENT LOGIN STRESS ---
  await runner.test('Stress: 6 parallel login requests complete successfully without pool exhaustion', async () => {
    const loginRequests = Array.from({ length: 6 }, (_, i) => {
      const username = i % 2 === 0 ? 'admin' : 'staff01';
      const password = i % 2 === 0 ? 'Admin@123' : 'Staff@123';
      return api('POST', '/api/auth/login', {
        body: { username, password },
      });
    });

    const results = await Promise.all(loginRequests);
    const allSuccessful = results.every((r) => r.status === 200 && r.data.success);
    assert.ok(allSuccessful, 'All parallel logins must succeed');
  });

  // --- 3. CONCURRENT REGISTRATION ADVISORY LOCK ---
  await runner.test('Concurrency: Advisory lock prevents duplicate parent account creation in parallel', async () => {
    const regUsername = `parent_race_${timestamp.toString().slice(-6)}`;
    const regEmail = `race_${timestamp}@test.com`;
    const regPayload = {
      username: regUsername,
      full_name: 'Race Parent Test',
      phone: `0999${timestamp.toString().slice(-6)}`,
      email: regEmail,
      password: 'StrongPassword123',
    };

    // Fire two identical registration requests concurrently
    const [res1, res2] = await Promise.all([
      api('POST', '/api/auth/register', { body: regPayload }),
      api('POST', '/api/auth/register', { body: regPayload }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.strictEqual(
      statuses[0],
      201,
      `Expected one registration to succeed with 201, got ${statuses[0]}`,
    );
    assert.strictEqual(
      statuses[1],
      409,
      `Expected duplicate registration to be rejected with 409, got ${statuses[1]}`,
    );

    // Cleanup created test account
    if (res1.status === 201 && res1.data?.data?.user_id) {
      await pool.query('delete from user_accounts where user_id = $1', [res1.data.data.user_id]);
    } else if (res2.status === 201 && res2.data?.data?.user_id) {
      await pool.query('delete from user_accounts where user_id = $1', [res2.data.data.user_id]);
    }
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
