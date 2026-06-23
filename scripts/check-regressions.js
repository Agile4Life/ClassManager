const assert = require('assert');
const { buildInsert, buildUpdate } = require('../src/utils/query');
const { timeToMinutes, isIsoDate, getPagination } = require('../src/utils/validation');

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

console.log('Regression checks passed.');
