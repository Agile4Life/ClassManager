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
  const runner = createSuiteRunner('Suite 07: Finance, Invoices & Payments');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  let testStudentId = null;
  let testClassId = null;
  let testInvoiceId = null;
  let testPaymentId = null;
  const timestamp = Date.now();

  // Setup: create test student
  const studentRes = await api('POST', '/api/students', {
    token: tokens.admin,
    body: {
      full_name: `Finance Student ${timestamp}`,
      gender: 'female',
      phone: `0977${timestamp.toString().slice(-6)}`,
    },
  });
  if (studentRes.status === 201) testStudentId = studentRes.data.data.student_id;

  // Setup: get or create class
  const subRes = await api('GET', '/api/subjects', { token: tokens.admin });
  const subjectId = subRes.data?.data?.[0]?.subject_id || 1;

  const classRes = await api('POST', '/api/classes', {
    token: tokens.admin,
    body: {
      class_name: `Finance Test Class ${timestamp}`,
      subject_id: subjectId,
      grade_level: 'Grade 12',
      max_students: 20,
      tuition_fee: 1000000,
    },
  });
  if (classRes.status === 201) testClassId = classRes.data.data.class_id;

  // --- 1. INVOICES ---
  await runner.test('Invoices: GET /api/invoices lists tuition invoices', async () => {
    const res = await api('GET', '/api/invoices', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(getList(res)));
  });

  await runner.test('Invoices: POST /api/invoices generates a new student invoice', async () => {
    assert.ok(testStudentId && testClassId, 'Student and class required');
    const res = await api('POST', '/api/invoices', {
      token: tokens.admin,
      body: {
        student_id: testStudentId,
        class_id: testClassId,
        invoice_month: 6,
        invoice_year: 2026,
        total_amount: 1000000,
        discount_amount: 100000,
        final_amount: 900000,
        due_date: '2026-06-15',
        status: 'unpaid',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.invoice_id);
    assert.strictEqual(Number(res.data.data.final_amount), 900000);
    testInvoiceId = res.data.data.invoice_id;
  });

  await runner.test('Invoices: GET /api/invoices/:id retrieves invoice details', async () => {
    assert.ok(testInvoiceId, 'Invoice required');
    const res = await api('GET', `/api/invoices/${testInvoiceId}`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.invoice_id, testInvoiceId);
  });

  await runner.test('Invoices: GET /api/students/:id/invoices lists invoices for student', async () => {
    const res = await api('GET', `/api/students/${testStudentId}/invoices`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
    const found = getList(res).find((inv) => inv.invoice_id === testInvoiceId);
    assert.ok(found, 'Created invoice must appear in student invoices list');
  });

  // --- 2. PAYMENTS ---
  await runner.test('Payments: POST /api/payments records tuition payment', async () => {
    assert.ok(testInvoiceId && testStudentId, 'Invoice and student required');
    const res = await api('POST', '/api/payments', {
      token: tokens.admin,
      body: {
        invoice_id: testInvoiceId,
        student_id: testStudentId,
        class_id: testClassId,
        amount: 900000,
        payment_date: '2026-06-10',
        payment_method: 'bank_transfer',
        transaction_code: `TXN${timestamp}`,
        status: 'paid',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.payment_id);
    assert.strictEqual(Number(res.data.data.amount), 900000);
    testPaymentId = res.data.data.payment_id;
  });

  await runner.test('Payments: GET /api/payments lists recorded payments', async () => {
    const res = await api('GET', '/api/payments', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
    const found = getList(res).find((p) => p.payment_id === testPaymentId);
    assert.ok(found, 'Recorded payment must appear in payments list');
  });

  await runner.test('Payments: GET /api/students/:id/payments lists payments for student', async () => {
    const res = await api('GET', `/api/students/${testStudentId}/payments`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
  });

  await runner.test('Invoices: PUT /api/invoices/:id updates invoice status to paid', async () => {
    const res = await api('PUT', `/api/invoices/${testInvoiceId}`, {
      token: tokens.admin,
      body: { status: 'paid' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.status, 'paid');
  });

  // Cleanup
  try {
    if (testInvoiceId) await api('DELETE', `/api/invoices/${testInvoiceId}`, { token: tokens.admin });
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
