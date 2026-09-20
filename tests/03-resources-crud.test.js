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
  const runner = createSuiteRunner('Suite 03: Core Resources CRUD (Subjects, Rooms, Teachers, Parents, Classes)');

  console.log(`\n\x1b[1m\x1b[36m=== ${runner.summary().suiteTitle} ===\x1b[0m`);

  let createdSubjectId = null;
  let createdRoomId = null;
  let createdTeacherId = null;
  let createdParentId = null;
  let createdClassId = null;
  const timestamp = Date.now();

  // --- 1. SUBJECTS ---
  await runner.test('Subjects: GET /api/subjects returns list of subjects', async () => {
    const res = await api('GET', '/api/subjects', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(getList(res)));
  });

  await runner.test('Subjects: POST /api/subjects creates a new subject', async () => {
    const res = await api('POST', '/api/subjects', {
      token: tokens.admin,
      body: {
        subject_code: `TS${timestamp.toString().slice(-4)}`,
        subject_name: `Test Subject ${timestamp}`,
        description: 'Automated test subject description',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.subject_id);
    createdSubjectId = res.data.data.subject_id;
  });

  await runner.test('Subjects: GET /api/subjects/:id retrieves single subject', async () => {
    assert.ok(createdSubjectId, 'Subject must be created first');
    const res = await api('GET', `/api/subjects/${createdSubjectId}`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.subject_id, createdSubjectId);
  });

  await runner.test('Subjects: PUT /api/subjects/:id updates existing subject', async () => {
    const res = await api('PUT', `/api/subjects/${createdSubjectId}`, {
      token: tokens.admin,
      body: { description: 'Updated test subject description' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.description, 'Updated test subject description');
  });

  // --- 2. ROOMS ---
  await runner.test('Rooms: GET /api/rooms returns list of rooms', async () => {
    const res = await api('GET', '/api/rooms', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
  });

  await runner.test('Rooms: POST /api/rooms creates a new room', async () => {
    const res = await api('POST', '/api/rooms', {
      token: tokens.admin,
      body: {
        room_name: `Room-Test-${timestamp.toString().slice(-4)}`,
        capacity: 35,
        location: '3rd Floor Test Wing',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.room_id);
    createdRoomId = res.data.data.room_id;
  });

  await runner.test('Rooms: PUT /api/rooms/:id updates room capacity', async () => {
    const res = await api('PUT', `/api/rooms/${createdRoomId}`, {
      token: tokens.admin,
      body: { capacity: 40 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Number(res.data.data.capacity), 40);
  });

  // --- 3. TEACHERS ---
  await runner.test('Teachers: POST /api/teachers creates a new teacher', async () => {
    const res = await api('POST', '/api/teachers', {
      token: tokens.admin,
      body: {
        teacher_code: `T${timestamp.toString().slice(-4)}`,
        full_name: `Test Teacher ${timestamp}`,
        phone: `0987${timestamp.toString().slice(-6)}`,
        email: `teacher.${timestamp}@example.com`,
        specialization: 'Physics',
        hourly_rate: 250000,
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.teacher_id);
    createdTeacherId = res.data.data.teacher_id;
  });

  await runner.test('Teachers: GET /api/teachers returns teacher list including new teacher', async () => {
    const res = await api('GET', '/api/teachers', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    const found = getList(res).find((t) => t.teacher_id === createdTeacherId);
    assert.ok(found, 'Created teacher must be listed');
  });

  await runner.test('Teachers: DELETE /api/teachers/:id soft deletes teacher', async () => {
    const res = await api('DELETE', `/api/teachers/${createdTeacherId}`, { token: tokens.admin });
    assert.strictEqual(res.status, 200);

    // Verify teacher is excluded from default active list
    const listRes = await api('GET', '/api/teachers', { token: tokens.admin });
    const stillPresent = getList(listRes).find((t) => t.teacher_id === createdTeacherId);
    assert.strictEqual(stillPresent, undefined, 'Soft deleted teacher must not appear in active list');
  });

  // --- 4. PARENTS ---
  await runner.test('Parents: POST /api/parents creates a parent record', async () => {
    const res = await api('POST', '/api/parents', {
      token: tokens.admin,
      body: {
        full_name: `Test Parent ${timestamp}`,
        phone: `0912${timestamp.toString().slice(-6)}`,
        email: `parent.${timestamp}@example.com`,
        address: '123 Test Boulevard',
        occupation: 'Senior Developer',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.parent_id);
    createdParentId = res.data.data.parent_id;
  });

  // --- 5. CLASSES ---
  await runner.test('Classes: Validation rejects negative tuition fee (400)', async () => {
    const res = await api('POST', '/api/classes', {
      token: tokens.admin,
      body: {
        class_name: 'Invalid Fee Class',
        subject_id: createdSubjectId,
        tuition_fee: -50000,
      },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('Classes: Validation rejects non-positive max_students (400)', async () => {
    const res = await api('POST', '/api/classes', {
      token: tokens.admin,
      body: {
        class_name: 'Invalid Capacity Class',
        subject_id: createdSubjectId,
        max_students: 0,
      },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  await runner.test('Classes: POST /api/classes creates a valid class with room and subject', async () => {
    const res = await api('POST', '/api/classes', {
      token: tokens.admin,
      body: {
        class_name: `Class Automation ${timestamp}`,
        subject_id: createdSubjectId,
        room_id: createdRoomId,
        grade_level: 'Grade 10',
        max_students: 25,
        tuition_fee: 950000,
        start_date: '2026-06-01',
        end_date: '2026-08-31',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.class_id);
    createdClassId = res.data.data.class_id;
  });

  await runner.test('Classes: GET /api/classes retrieves list with decorated teachers', async () => {
    const res = await api('GET', '/api/classes', { token: tokens.admin });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(getList(res)));
    const target = getList(res).find((c) => c.class_id === createdClassId);
    assert.ok(target, 'Created class must be present in classes list');
  });

  // Clean up created resources
  try {
    if (createdClassId) await api('DELETE', `/api/classes/${createdClassId}`, { token: tokens.admin });
    if (createdParentId) await api('DELETE', `/api/parents/${createdParentId}`, { token: tokens.admin });
    if (createdRoomId) await api('DELETE', `/api/rooms/${createdRoomId}`, { token: tokens.admin });
    if (createdSubjectId) await api('DELETE', `/api/subjects/${createdSubjectId}`, { token: tokens.admin });
  } catch (err) {
    // cleanup best effort
  }

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
