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
  const runner = createSuiteRunner('Suite 02: Authentication, Sessions & RBAC Authorization');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  // --- Authentication tests ---
  await runner.test('Auth: Login succeeds with valid admin credentials', async () => {
    const res = await api('POST', '/api/auth/login', {
      body: { username: 'admin', password: 'Admin@123' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.token, 'Token must be returned');
    assert.strictEqual(res.data.data.user.role, 'admin');
    assert.strictEqual(res.data.data.user.username, 'admin');
  });

  await runner.test('Auth: Login succeeds for all standard roles (staff, teacher, parent, student)', async () => {
    const roles = [
      { u: 'staff01', p: 'Staff@123', r: 'staff' },
      { u: 'teacher01', p: 'Teacher@123', r: 'teacher' },
      { u: 'parent01', p: 'Parent@123', r: 'parent' },
      { u: 'student01', p: 'Student@123', r: 'student' },
    ];
    for (const item of roles) {
      const res = await api('POST', '/api/auth/login', {
        body: { username: item.u, password: item.p },
      });
      assert.strictEqual(res.status, 200, `Login failed for ${item.u}: status ${res.status}`);
      assert.strictEqual(res.data.data.user.role, item.r);
    }
  });

  await runner.test('Auth: Login with invalid password returns 401 Unauthorized', async () => {
    const res = await api('POST', '/api/auth/login', {
      body: { username: 'admin', password: 'WrongPassword!@#' },
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('Auth: Login with non-existent user returns 401 Unauthorized', async () => {
    const res = await api('POST', '/api/auth/login', {
      body: { username: 'user_does_not_exist_xyz', password: 'SomePassword123' },
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('Auth: Missing username or password returns 400 Bad Request', async () => {
    const res = await api('POST', '/api/auth/login', {
      body: { username: 'admin' },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('Auth: Protected route /api/auth/me rejects request without token with 401', async () => {
    const res = await api('GET', '/api/auth/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('Auth: Protected route /api/auth/me rejects invalid token with 401', async () => {
    const res = await api('GET', '/api/auth/me', { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('Auth: /api/auth/me returns identity matching authenticated user', async () => {
    const res = await api('GET', '/api/auth/me', { token: tokens.teacher });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.username, 'teacher01');
    assert.strictEqual(res.data.data.role, 'teacher');
    assert.ok(res.data.data.teacher_id, 'teacher_id must be present for teacher account');
  });

  // --- RBAC Authorization tests ---
  await runner.test('RBAC: Admin can access /api/admin/accounts (200 OK)', async () => {
    const res = await api('GET', '/api/admin/accounts', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(getList(res)), 'Accounts should be returned as an array');
  });

  await runner.test('RBAC: Staff is rejected from /api/admin/accounts (403 Forbidden)', async () => {
    const res = await api('GET', '/api/admin/accounts', { token: tokens.staff });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('RBAC: Teacher is rejected from /api/admin/accounts (403 Forbidden)', async () => {
    const res = await api('GET', '/api/admin/accounts', { token: tokens.teacher });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('RBAC: Parent is rejected from /api/admin/accounts (403 Forbidden)', async () => {
    const res = await api('GET', '/api/admin/accounts', { token: tokens.parent });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('RBAC: Student is rejected from /api/admin/accounts (403 Forbidden)', async () => {
    const res = await api('GET', '/api/admin/accounts', { token: tokens.student });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('Session & Logout: POST /api/auth/logout revokes session in DB', async () => {
    // 1. Log in to create fresh session
    const loginRes = await api('POST', '/api/auth/login', {
      body: { username: 'student01', password: 'Student@123' },
    });
    assert.strictEqual(loginRes.status, 200);
    const freshToken = loginRes.data.data.token;

    // 2. Verify token works
    const meRes1 = await api('GET', '/api/auth/me', { token: freshToken });
    assert.strictEqual(meRes1.status, 200);

    // 3. Logout
    const logoutRes = await api('POST', '/api/auth/logout', { token: freshToken });
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutRes.data.success, true);

    // 4. Token must now be rejected
    const meRes2 = await api('GET', '/api/auth/me', { token: freshToken });
    assert.strictEqual(meRes2.status, 401, 'Revoked session must reject token with 401');
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
