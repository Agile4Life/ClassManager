const { setupTestEnvironment, getAuthTokens, api, teardownTestEnvironment } = require('../tests/helpers/test-env');

async function main() {
  console.log('Starting setup...');
  await setupTestEnvironment();
  console.log('Setup complete. Getting tokens...');
  const tokens = await getAuthTokens();
  console.log('Tokens retrieved:', Object.keys(tokens));
  console.log('Testing /api/health...');
  const health = await api('GET', '/api/health');
  console.log('Health:', health.status, health.data);
  console.log('Testing /api/admin/accounts with admin token...');
  const accounts = await api('GET', '/api/admin/accounts', { token: tokens.admin });
  console.log('Accounts:', accounts.status, accounts.data?.success, 'count:', accounts.data?.data?.length);
  await teardownTestEnvironment(true);
  console.log('Teardown complete.');
}

main().catch(err => {
  console.error('Error in main:', err);
  process.exit(1);
});
