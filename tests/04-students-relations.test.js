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
  const runner = createSuiteRunner('Suite 04: Students, Parents Links, Import & Class Enrollment');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  let createdStudentId = null;
  let testParentId = null;
  let testClassId = null;
  const timestamp = Date.now();

  // Pre-requisites: create test parent and test class
  const parentRes = await api('POST', '/api/parents', {
    token: tokens.admin,
    body: {
      full_name: `Parent Test ${timestamp}`,
      phone: `0925${timestamp.toString().slice(-6)}`,
      email: `parent${timestamp}@test.local`,
    },
  });
  if (parentRes.status === 201) testParentId = parentRes.data.data.parent_id;

  // Get active subject for test class
  const subRes = await api('GET', '/api/subjects', { token: tokens.admin });
  const subjectId = subRes.data?.data?.[0]?.subject_id || 1;

  const classRes = await api('POST', '/api/classes', {
    token: tokens.admin,
    body: {
      class_name: `Enrollment Test Class ${timestamp}`,
      subject_id: subjectId,
      grade_level: 'Grade 9',
      max_students: 20,
      tuition_fee: 500000,
    },
  });
  if (classRes.status === 201) testClassId = classRes.data.data.class_id;

  // --- 1. STUDENTS CRUD ---
  await runner.test('Students: GET /api/students returns paginated student list', async () => {
    const res = await api('GET', '/api/students?page=1&limit=10', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(getList(res)));
  });

  await runner.test('Students: POST /api/students creates a student with auto-generated student_code', async () => {
    const res = await api('POST', '/api/students', {
      token: tokens.admin,
      body: {
        full_name: `Student Automation ${timestamp}`,
        date_of_birth: '2010-04-15',
        gender: 'female',
        phone: `0934${timestamp.toString().slice(-6)}`,
        email: `student.${timestamp}@example.com`,
        school_name: 'Nguyen Du School',
        grade_level: 'Grade 9',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.student_id);
    assert.ok(res.data.data.student_code, 'Student code must be auto-generated');
    createdStudentId = res.data.data.student_id;
  });

  await runner.test('Students: GET /api/students/:id returns student profile', async () => {
    const res = await api('GET', `/api/students/${createdStudentId}`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.student_id, createdStudentId);
    assert.strictEqual(res.data.data.full_name, `Student Automation ${timestamp}`);
  });

  await runner.test('Students: PUT /api/students/:id updates student record', async () => {
    const res = await api('PUT', `/api/students/${createdStudentId}`, {
      token: tokens.admin,
      body: {
        full_name: `Student Automation Updated ${timestamp}`,
        student_phone: `0934${timestamp.toString().slice(-6)}`,
        status: 'active',
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.full_name, `Student Automation Updated ${timestamp}`);
  });

  // --- 2. BATCH IMPORT ---
  await runner.test('Students: POST /api/students/import normalizes and batch creates students', async () => {
    const importPayload = {
      rows: [
        {
          full_name: `Batch Student A ${timestamp}`,
          student_phone: `0901${timestamp.toString().slice(-6)}`,
          father_phone: '0901234567',
          mother_phone: '0907654321',
        },
      ],
    };
    const res = await api('POST', '/api/students/import', {
      token: tokens.admin,
      body: importPayload,
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.imported_count >= 1);
  });

  // --- 3. STUDENT-PARENT RELATIONSHIP ---
  await runner.test('Relationships: Link student to parent via POST /api/students/:id/parents/:parentId', async () => {
    assert.ok(testParentId, 'Test parent required');
    const res = await api('POST', `/api/students/${createdStudentId}/parents/${testParentId}`, {
      token: tokens.admin,
      body: {
        relationship: 'mother',
        is_primary_contact: true,
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.relationship, 'mother');
    assert.strictEqual(res.data.data.is_primary_contact, true);
  });

  await runner.test('Relationships: GET /api/students/:id/parents lists linked parents', async () => {
    const res = await api('GET', `/api/students/${createdStudentId}/parents`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
    const linked = getList(res).find((p) => p.parent_id === testParentId);
    assert.ok(linked, 'Linked parent must be returned in query');
  });

  // --- 4. CLASS ENROLLMENT ---
  await runner.test('Enrollment: POST /api/classes/:classId/enroll/:studentId enrolls student', async () => {
    assert.ok(testClassId, 'Test class required');
    const res = await api('POST', `/api/classes/${testClassId}/enroll/${createdStudentId}`, {
      token: tokens.admin,
      body: {
        status: 'studying',
        discount_percent: 10,
        note: 'Early bird registration',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.student_id, createdStudentId);
    assert.strictEqual(res.data.data.class_id, testClassId);
  });

  await runner.test('Enrollment: Duplicate enrollment attempt is rejected with 409 Conflict', async () => {
    const res = await api('POST', `/api/classes/${testClassId}/enroll/${createdStudentId}`, {
      token: tokens.admin,
      body: { status: 'studying' },
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('Enrollment: GET /api/classes/:classId/students lists enrolled students', async () => {
    const res = await api('GET', `/api/classes/${testClassId}/students`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
    const enrolled = getList(res).find((s) => s.student_id === createdStudentId);
    assert.ok(enrolled, 'Enrolled student must appear in class students list');
  });

  // --- 5. SOFT DELETE ---
  await runner.test('Students: DELETE /api/students/:id marks student as soft-deleted', async () => {
    const res = await api('DELETE', `/api/students/${createdStudentId}`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);

    // Verify student is not in active list
    const listRes = await api('GET', '/api/students', { token: tokens.admin });
    const found = getList(listRes).find((s) => s.student_id === createdStudentId);
    assert.strictEqual(found, undefined, 'Soft deleted student must be excluded from default list');
  });

  // Cleanup test class and parent
  try {
    if (testClassId) await api('DELETE', `/api/classes/${testClassId}`, { token: tokens.admin });
    if (testParentId) await api('DELETE', `/api/parents/${testParentId}`, { token: tokens.admin });
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
