const { setupTestEnvironment, getAuthTokens, api, teardownTestEnvironment } = require('../tests/helpers/test-env');

async function test() {
  await setupTestEnvironment();
  const tokens = await getAuthTokens();
  console.log('Testing class-schema...');
  const t0 = Date.now();
  const schemaRes = await api('GET', '/api/admin/debug/class-schema', { token: tokens.admin });
  console.log('Schema:', schemaRes.status, `(${Date.now() - t0}ms)`);
  
  console.log('Testing class-create-probe...');
  const t1 = Date.now();
  const probeRes = await api('POST', '/api/admin/debug/class-create-probe', {
    token: tokens.admin,
    body: { class_name: 'Debug Probe Class' },
  });
  console.log('Probe:', probeRes.status, probeRes.data?.data?.phase, `(${Date.now() - t1}ms)`);
  await teardownTestEnvironment(true);
}

test().catch(console.error);
