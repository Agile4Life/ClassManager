const { setupTestEnvironment, getAuthTokens, api, teardownTestEnvironment, pool } = require('../tests/helpers/test-env');

async function debug() {
  await setupTestEnvironment();
  const tokens = await getAuthTokens();
  console.log('Step 1: create class with max_students = 1');
  const classRes = await api('POST', '/api/classes', {
    token: tokens.admin,
    body: {
      class_name: `Debug Race Class ${Date.now()}`,
      subject_id: 1,
      max_students: 1,
      tuition_fee: 100000,
    },
  });
  console.log('Class created:', classRes.status, classRes.data);
  const classId = classRes.data?.data?.class_id;

  console.log('Step 2: create 2 students');
  const s1 = await api('POST', '/api/students', {
    token: tokens.admin,
    body: { full_name: 'Student 1', phone: '0911223344', gender: 'male' },
  });
  const s2 = await api('POST', '/api/students', {
    token: tokens.admin,
    body: { full_name: 'Student 2', phone: '0911223355', gender: 'female' },
  });
  console.log('Students created:', s1.status, s2.status);

  console.log('Step 3: fire 2 concurrent enrollments');
  const t0 = Date.now();
  const [r1, r2] = await Promise.all([
    api('POST', `/api/classes/${classId}/enroll/${s1.data.data.student_id}`, {
      token: tokens.admin,
      body: { status: 'studying' },
    }),
    api('POST', `/api/classes/${classId}/enroll/${s2.data.data.student_id}`, {
      token: tokens.admin,
      body: { status: 'studying' },
    }),
  ]);
  console.log('Concurrent enrollments done in', Date.now() - t0, 'ms');
  console.log('Result 1:', r1.status, r1.data?.message);
  console.log('Result 2:', r2.status, r2.data?.message);

  // cleanup
  await api('DELETE', `/api/classes/${classId}`, { token: tokens.admin });
  await api('DELETE', `/api/students/${s1.data.data.student_id}`, { token: tokens.admin });
  await api('DELETE', `/api/students/${s2.data.data.student_id}`, { token: tokens.admin });
  await teardownTestEnvironment(true);
}

debug().catch(console.error);
