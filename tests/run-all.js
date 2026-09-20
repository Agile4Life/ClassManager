const fs = require('fs');
const path = require('path');
const {
  setupTestEnvironment,
  teardownTestEnvironment,
  getAuthTokens,
} = require('./helpers/test-env');

const suite01 = require('./01-health-smoke.test');
const suite02 = require('./02-auth-rbac.test');
const suite03 = require('./03-resources-crud.test');
const suite04 = require('./04-students-relations.test');
const suite05 = require('./05-timetable-sessions.test');
const suite06 = require('./06-academic-assignments.test');
const suite07 = require('./07-finance-invoices.test');
const suite08 = require('./08-reports-analytics.test');
const suite09 = require('./09-security-validation.test');
const suite10 = require('./10-concurrency-race.test');

const suites = [
  { id: '01', name: 'Health & System Smoke', fn: suite01 },
  { id: '02', name: 'Authentication & RBAC', fn: suite02 },
  { id: '03', name: 'Core Resources CRUD', fn: suite03 },
  { id: '04', name: 'Students & Enrollment', fn: suite04 },
  { id: '05', name: 'Timetable & Attendance', fn: suite05 },
  { id: '06', name: 'Academic & Assignments', fn: suite06 },
  { id: '07', name: 'Finance & Invoices', fn: suite07 },
  { id: '08', name: 'Reports & Analytics', fn: suite08 },
  { id: '09', name: 'Security & Validation', fn: suite09 },
  { id: '10', name: 'Concurrency & Race Conditions', fn: suite10 },
];

async function main() {
  console.log('\x1b[1m\x1b[35m');
  console.log('===============================================================');
  console.log('       CLASSMANAGER FULL-SUITE AUTOMATED TEST RUNNER           ');
  console.log('===============================================================\x1b[0m');

  const startTime = Date.now();
  await setupTestEnvironment();
  console.log('\x1b[90m[Init] Ephemeral HTTP Server & DB Connection ready.\x1b[0m');

  await getAuthTokens();
  console.log('\x1b[90m[Init] User authentication sessions pre-warmed for all roles.\x1b[0m\n');

  const summaries = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    try {
      const summary = await suite.fn();
      summaries.push(summary);
      totalTests += summary.total;
      totalPassed += summary.passed;
      totalFailed += summary.failed;
    } catch (err) {
      console.error(`\x1b[31mSuite ${suite.id} encountered unexpected error:\x1b[0m`, err);
      summaries.push({
        suiteTitle: suite.name,
        passed: 0,
        failed: 1,
        total: 1,
        errors: [{ test: 'Suite Execution', error: err.message }],
        testResults: [{ name: 'Suite Execution', status: 'FAILED', error: err.message }],
      });
      totalTests += 1;
      totalFailed += 1;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n\x1b[1m\x1b[35m===============================================================\x1b[0m');
  console.log('\x1b[1m                       TEST SUMMARY REPORT                     \x1b[0m');
  console.log('\x1b[1m\x1b[35m===============================================================\x1b[0m');

  console.log('\x1b[1m%-32s %-10s %-10s %-8s\x1b[0m', 'Suite Name', 'Total', 'Passed', 'Status');
  console.log('---------------------------------------------------------------');

  for (const s of summaries) {
    const status = s.failed === 0 ? '\x1b[32mPASSED\x1b[0m' : `\x1b[31mFAILED (${s.failed})\x1b[0m`;
    const shortTitle = s.suiteTitle.length > 30 ? `${s.suiteTitle.slice(0, 27)}...` : s.suiteTitle;
    console.log(`%-32s %-10d %-10d ${status}`, shortTitle, s.total, s.passed);
  }

  console.log('---------------------------------------------------------------');
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0';
  console.log(
    `\x1b[1mTotal Tests: \x1b[36m${totalTests}\x1b[0m | ` +
    `Passed: \x1b[32m${totalPassed}\x1b[0m | ` +
    `Failed: \x1b[31m${totalFailed}\x1b[0m | ` +
    `Pass Rate: \x1b[33m${passRate}%\x1b[0m | ` +
    `Duration: \x1b[35m${duration}s\x1b[0m`
  );
  console.log('\x1b[1m\x1b[35m===============================================================\x1b[0m\n');

  // Generate structured report JSON
  const report = {
    timestamp: new Date().toISOString(),
    durationSeconds: parseFloat(duration),
    stats: {
      suitesCount: suites.length,
      totalTests,
      totalPassed,
      totalFailed,
      passRate: `${passRate}%`,
    },
    suites: summaries,
  };

  const reportPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\x1b[32m✔ Detailed JSON test results saved to: ${reportPath}\x1b[0m`);

  await teardownTestEnvironment(true);
  process.exitCode = totalFailed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('\x1b[31mFatal test runner error:\x1b[0m', err);
  teardownTestEnvironment(true).finally(() => {
    process.exit(1);
  });
});
