const assert = require('assert');
const {
  setupTestEnvironment,
  teardownTestEnvironment,
  getAuthTokens,
  api,
  getList,
  createSuiteRunner,
} = require('./helpers/test-env');
const { buildInsert, buildUpdate } = require('../backend/utils/query');
const { timeToMinutes, isIsoDate, getPagination } = require('../backend/utils/validation');
const { validateRegistration } = require('../backend/utils/registration');

async function run() {
  await setupTestEnvironment();
  const tokens = await getAuthTokens();
  const runner = createSuiteRunner('Suite 09: Security, Input Validation & SQL Injection Defenses');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  // --- 1. SQL INJECTION DEFENSE IN APIS ---
  await runner.test("SQLi: Search query with ' OR '1'='1' is treated as literal search text", async () => {
    const res = await api('GET', "/api/subjects?search=' OR '1'='1' --", { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    // Because it's parameterized, it searches for the literal string, so 0 subjects match
    assert.strictEqual(getList(res).length, 0);
  });

  await runner.test('SQLi: Semicolon DROP TABLE attempt does not execute or harm database', async () => {
    const res = await api('GET', '/api/students?search=; DROP TABLE students; --', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    // Verify students table is still intact
    const verifyRes = await api('GET', '/api/students', { token: tokens.admin });
    assert.strictEqual(verifyRes.status, 200);
  });

  // --- 2. QUERY BUILDER INJECTION REJECTION ---
  await runner.test('Query Builder: Malicious table name throws invalid table error', async () => {
    assert.throws(
      () => buildInsert('students; drop table students', { full_name: 'test' }),
      /Table name is invalid/,
    );
  });

  await runner.test('Query Builder: Malicious column name throws invalid column error', async () => {
    assert.throws(
      () => buildInsert('students', { 'full_name) values (null); --': 'test' }),
      /Column name is invalid/,
    );
  });

  await runner.test('Query Builder: Malicious primary key throws invalid primary key error', async () => {
    assert.throws(
      () => buildUpdate('students', 'student_id or 1=1', 1, { full_name: 'test' }),
      /Primary key is invalid/,
    );
  });

  // --- 3. INPUT VALIDATION & REGISTRATION RULES ---
  await runner.test('Validation: timeToMinutes rejects invalid clock values', async () => {
    assert.strictEqual(timeToMinutes('00:00'), 0);
    assert.strictEqual(timeToMinutes('23:59'), 1439);
    assert.strictEqual(timeToMinutes('24:00'), null);
    assert.strictEqual(timeToMinutes('12:60'), null);
  });

  await runner.test('Validation: isIsoDate detects impossible calendar dates', async () => {
    assert.strictEqual(isIsoDate('2026-06-23'), true);
    assert.strictEqual(isIsoDate('2026-02-30'), false);
    assert.strictEqual(isIsoDate('invalid-date'), false);
  });

  await runner.test('Validation: getPagination enforces positive page bounds', async () => {
    assert.deepStrictEqual(getPagination({ page: '2', limit: '10' }), { page: 2, limit: 10, offset: 10 });
    assert.throws(() => getPagination({ page: '0' }), /page must be a positive integer/);
    assert.throws(() => getPagination({ limit: '-5' }), /limit must be a positive integer/);
  });

  await runner.test('Registration: Enforces username length, phone format and password rules', async () => {
    // Too short username
    assert.throws(
      () => validateRegistration({ username: 'ab', full_name: 'An', phone: '0901234567', password: 'ValidPassword123' }),
      /Tên đăng nhập/,
    );
    // Too short password
    assert.throws(
      () => validateRegistration({ username: 'user123', full_name: 'An', phone: '0901234567', password: 'short' }),
      /Mật khẩu/,
    );
  });

  // --- 4. PRIVILEGE ESCALATION DEFENSE ---
  await runner.test('Privilege Escalation: Student cannot change role to admin via PUT /api/auth/me', async () => {
    const res = await api('PUT', '/api/auth/me', {
      token: tokens.student,
      body: { role: 'admin' },
    });
    // The role must remain student
    const checkRes = await api('GET', '/api/auth/me', { token: tokens.student });
    assert.strictEqual(checkRes.data.data.role, 'student', 'Student role must not be changed');
  });

  await runner.test('Privilege Escalation: Teacher cannot create admin user in /api/admin/accounts', async () => {
    const res = await api('POST', '/api/admin/accounts', {
      token: tokens.teacher,
      body: {
        username: 'malicious_admin',
        password: 'Password123',
        role: 'admin',
      },
    });
    assert.strictEqual(res.status, 403, 'Teacher must receive 403 Forbidden');
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
