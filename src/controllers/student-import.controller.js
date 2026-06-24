const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { success } = require('../utils/response');
const { generateNextCode } = require('../utils/code-generator');
const { normalizeStudentImportRows } = require('../utils/student-import');

async function getOrCreateParent(client, { phone, relationship, studentName }) {
  let result = await client.query(
    `select distinct p.parent_id from parents p
     join student_parents sp on sp.parent_id = p.parent_id
     where p.phone = $1 and sp.relationship = $2
     order by p.parent_id limit 1`,
    [phone, relationship],
  );
  if (!result.rowCount) {
    result = await client.query(
      `select p.parent_id from parents p
       where p.phone = $1 and not exists (
         select 1 from student_parents sp where sp.parent_id = p.parent_id
       ) order by p.parent_id limit 1`,
      [phone],
    );
  }
  if (result.rowCount) return result.rows[0].parent_id;
  const label = relationship === 'father' ? 'Ba' : 'Mẹ';
  result = await client.query(
    'insert into parents (full_name, phone) values ($1, $2) returning parent_id',
    [`${label} của ${studentName}`.slice(0, 100), phone],
  );
  return result.rows[0].parent_id;
}

const importStudents = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) throw new AppError(400, 'File CSV không có học sinh để nhập');
  if (rows.length > 1000) throw new AppError(400, 'Mỗi lần chỉ được nhập tối đa 1000 học sinh');

  const normalized = normalizeStudentImportRows(rows);
  const invalidRows = normalized.filter((row) => row.errors.length);
  if (invalidRows.length) {
    const preview = invalidRows.slice(0, 5).map((row) => `Dòng ${row.rowNumber}: ${row.errors.join(', ')}`).join('; ');
    throw new AppError(400, `Có ${invalidRows.length} dòng không hợp lệ. ${preview}`, invalidRows);
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const firstCode = await generateNextCode(client, {
      table: 'students', column: 'student_code', prefix: 'S', digits: 3,
    });
    const firstNumber = Number(firstCode.slice(1));
    const columnsPerRow = 3;
    const placeholders = normalized.map((_, index) => {
      const start = index * columnsPerRow;
      return `(${Array.from({ length: columnsPerRow }, (unused, column) => `$${start + column + 1}`).join(', ')})`;
    });
    const values = normalized.flatMap((row, index) => {
      const item = row.value;
      const code = `S${String(firstNumber + index).padStart(3, '0')}`;
      return [code, item.full_name, item.student_phone];
    });
    const result = await client.query(
      `insert into students
         (student_code, full_name, phone)
       values ${placeholders.join(', ')}
       returning student_id, student_code, full_name`,
      values,
    );
    const studentByCode = new Map(result.rows.map((student) => [student.student_code, student]));
    let parentLinks = 0;
    for (let index = 0; index < normalized.length; index += 1) {
      const item = normalized[index].value;
      const code = `S${String(firstNumber + index).padStart(3, '0')}`;
      const student = studentByCode.get(code);
      const contacts = [
        { phone: item.father_phone, relationship: 'father' },
        { phone: item.mother_phone, relationship: 'mother' },
      ].filter((contact) => contact.phone);
      const primaryRelationship = contacts.some((contact) => contact.relationship === 'mother') ? 'mother' : 'father';
      for (const contact of contacts) {
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [`parent-contact:${contact.relationship}:${contact.phone}`]);
        const parentId = await getOrCreateParent(client, {
          ...contact,
          studentName: item.full_name,
        });
        await client.query(
          `insert into student_parents (student_id, parent_id, relationship, is_primary_contact)
           values ($1, $2, $3, $4)
           on conflict (student_id, parent_id) do update set
             relationship = excluded.relationship,
             is_primary_contact = excluded.is_primary_contact`,
          [student.student_id, parentId, contact.relationship, contact.relationship === primaryRelationship],
        );
        parentLinks += 1;
      }
    }
    await client.query('commit');
    return success(res, {
      imported_count: result.rowCount,
      parent_links_created: parentLinks,
      items: result.rows,
    }, `Đã nhập ${result.rowCount} học sinh`, 201);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

module.exports = { importStudents };
