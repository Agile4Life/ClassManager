const assert = require('assert');
const {
  setupTestEnvironment,
  teardownTestEnvironment,
  getAuthTokens,
  api,
  createSuiteRunner,
} = require('./helpers/test-env');

async function run() {
  await setupTestEnvironment();
  const tokens = await getAuthTokens();
  const runner = createSuiteRunner('Suite 01: Health, Smoke & System Infrastructure');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  await runner.test('GET /api/health returns 200 with status ok and database time', async () => {
    const res = await api('GET', '/api/health');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.status, 'ok');
    assert.ok(res.data.data.database_time, 'Missing database_time in health response');
    const parsedDate = new Date(res.data.data.database_time);
    assert.ok(!isNaN(parsedDate.getTime()), 'database_time must be a valid date');
  });

  await runner.test('Security: X-Powered-By header is disabled', async () => {
    const res = await api('GET', '/api/health');
    assert.strictEqual(res.headers.get('x-powered-by'), null, 'x-powered-by header must not be sent');
  });

  await runner.test('Routing: Non-existent non-API endpoint /not-found-xyz returns 404', async () => {
    const res = await api('GET', '/not-found-xyz');
    assert.strictEqual(res.status, 404, `Expected 404, got ${res.status}`);
  });

  await runner.test('Routing: Authenticated call to unknown API endpoint /api/not-found-xyz returns 404 JSON', async () => {
    const res = await api('GET', '/api/not-found-xyz', { token: tokens.admin });
    assert.strictEqual(res.status, 404, `Expected 404, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('CORS: Development localhost origin is permitted', async () => {
    const res = await api('GET', '/api/health', {
      headers: { Origin: 'http://127.0.0.1:5174' },
    });
    assert.strictEqual(res.status, 200);
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.ok(allowOrigin === 'http://127.0.0.1:5174' || allowOrigin === '*', `Unexpected CORS header: ${allowOrigin}`);
  });

  await runner.test('Admin Debug: GET /api/admin/debug/class-schema requires admin auth', async () => {
    // Unauthenticated
    const unauth = await api('GET', '/api/admin/debug/class-schema');
    assert.strictEqual(unauth.status, 401, `Expected 401 unauth, got ${unauth.status}`);

    // Non-admin (student)
    const forbidden = await api('GET', '/api/admin/debug/class-schema', { token: tokens.student });
    assert.strictEqual(forbidden.status, 403, `Expected 403 forbidden for student, got ${forbidden.status}`);

    // Admin
    const ok = await api('GET', '/api/admin/debug/class-schema', { token: tokens.admin });
    assert.strictEqual(ok.status, 200, `Expected 200 for admin, got ${ok.status}`);
    assert.ok(Array.isArray(ok.data.data.tables), 'Expected tables array');
    assert.ok(Array.isArray(ok.data.data.columns), 'Expected columns array');
  });

  await runner.test('Admin Debug: POST /api/admin/debug/class-create-probe safely executes and rolls back', async () => {
    const res = await api('POST', '/api/admin/debug/class-create-probe', {
      token: tokens.admin,
      body: { class_name: 'Test Probe Class 101' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.phase, 'rolled back');
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
