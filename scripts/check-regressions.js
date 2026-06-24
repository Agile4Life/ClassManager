const assert = require('assert');
const { buildInsert, buildUpdate } = require('../src/utils/query');
const { timeToMinutes, isIsoDate, getPagination } = require('../src/utils/validation');
const { parseOrigins, isOriginAllowed } = require('../src/utils/cors');
const { generateNextCode } = require('../src/utils/code-generator');
const { validateRegistration } = require('../src/utils/registration');
const { normalizeStudentImportRows } = require('../src/utils/student-import');

const insert = buildInsert('students', { student_code: 'S100', full_name: 'Test Student' });
assert.strictEqual(
  insert.text,
  'insert into "students" ("student_code", "full_name") values ($1, $2) returning *',
);
assert.deepStrictEqual(insert.values, ['S100', 'Test Student']);

const update = buildUpdate('classes', 'class_id', 1, { max_students: 25 });
assert.strictEqual(
  update.text,
  'update "classes" set "max_students" = $1 where "class_id" = $2 returning *',
);

assert.throws(() => buildInsert('students; drop table students', { full_name: 'x' }), /Table name is invalid/);
assert.throws(() => buildInsert('students', { 'full_name) values (null); --': 'x' }), /Column name is invalid/);
assert.throws(() => buildUpdate('students', 'student_id or 1=1', 1, { full_name: 'x' }), /Primary key is invalid/);

assert.strictEqual(timeToMinutes('00:00'), 0);
assert.strictEqual(timeToMinutes('23:59:00'), 1439);
assert.strictEqual(timeToMinutes('24:00'), null);
assert.strictEqual(isIsoDate('2026-06-23'), true);
assert.strictEqual(isIsoDate('2026-02-30'), false);
assert.deepStrictEqual(getPagination({ page: '2', limit: '10' }), { page: 2, limit: 10, offset: 10 });
assert.throws(() => getPagination({ page: '0' }), /page must be a positive integer/);

assert.deepStrictEqual(
  validateRegistration({
    username: ' Parent.01 ', full_name: ' Nguyễn Văn An ', phone: '0901234567',
    email: ' Parent@Example.com ', password: 'Matkhau123',
  }),
  {
    username: 'parent.01', fullName: 'Nguyễn Văn An', phone: '0901234567',
    email: 'parent@example.com', password: 'Matkhau123',
  },
);
assert.throws(
  () => validateRegistration({ username: 'ab', full_name: 'An', phone: '0901234567', password: 'Matkhau123' }),
  /Tên đăng nhập/,
);

const importedStudents = normalizeStudentImportRows([
  { full_name: 'Nguyễn Văn An', date_of_birth: '2010-05-12', gender: 'male', status: 'active' },
  { full_name: '', date_of_birth: '2010-02-30', gender: 'unknown', email: 'invalid', status: 'active' },
]);
assert.deepStrictEqual(importedStudents[0].errors, []);
assert.strictEqual(importedStudents[0].value.full_name, 'Nguyễn Văn An');
assert.strictEqual(importedStudents[1].rowNumber, 3);
assert.strictEqual(importedStudents[1].errors.length, 4);
assert.throws(
  () => validateRegistration({ username: 'parent02', full_name: 'An', phone: '0901234567', password: 'abcdefgh' }),
  /Mật khẩu/,
);

const codeQueries = [];
const codeClient = {
  async query(text, values) {
    codeQueries.push({ text, values });
    if (text.startsWith('select coalesce')) return { rows: [{ next_number: '4' }] };
    return { rows: [{}] };
  },
};

const requestFrom = (host, forwardedHost, protocol = 'https', forwardedProtocol) => ({
  protocol,
  get(header) {
    if (header === 'host') return host;
    if (header === 'x-forwarded-host') return forwardedHost;
    if (header === 'x-forwarded-proto') return forwardedProtocol;
    return undefined;
  },
});
const configuredOrigins = parseOrigins('https://admin.example.com, https://staff.example.com');
assert.deepStrictEqual(configuredOrigins, ['https://admin.example.com', 'https://staff.example.com']);
assert.strictEqual(isOriginAllowed({
  req: requestFrom('api.example.com'),
  origin: 'https://admin.example.com',
  configuredOrigins,
  nodeEnv: 'production',
}), true);
assert.strictEqual(isOriginAllowed({
  req: requestFrom('class-manager.vercel.app'),
  origin: 'https://class-manager.vercel.app',
  configuredOrigins,
  nodeEnv: 'production',
}), true);
assert.strictEqual(isOriginAllowed({
  req: requestFrom('internal-host', 'class-manager.vercel.app', 'http', 'https'),
  origin: 'https://class-manager.vercel.app',
  configuredOrigins,
  nodeEnv: 'production',
}), true);
assert.strictEqual(isOriginAllowed({
  req: requestFrom('localhost:3005', undefined, 'http'),
  origin: 'http://127.0.0.1:5174',
  configuredOrigins,
  nodeEnv: 'development',
}), true);
assert.strictEqual(isOriginAllowed({
  req: requestFrom('api.example.com'),
  origin: 'https://evil.example.com',
  configuredOrigins,
  nodeEnv: 'production',
}), false);

generateNextCode(codeClient, { table: 'students', column: 'student_code', prefix: 'S', digits: 3 })
  .then((code) => {
    assert.strictEqual(code, 'S004');
    assert.strictEqual(codeQueries[0].values[0], 'auto-code:students:student_code');
    assert.strictEqual(codeQueries[1].values[0], '^S([0-9]+)$');
    console.log('Regression checks passed.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
