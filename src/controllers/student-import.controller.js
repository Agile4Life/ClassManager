const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { success } = require('../utils/response');
const { generateNextCode } = require('../utils/code-generator');
const { normalizeStudentImportRows } = require('../utils/student-import');

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
    const columnsPerRow = 11;
    const placeholders = normalized.map((_, index) => {
      const start = index * columnsPerRow;
      return `(${Array.from({ length: columnsPerRow }, (unused, column) => `$${start + column + 1}`).join(', ')})`;
    });
    const values = normalized.flatMap((row, index) => {
      const item = row.value;
      const code = `S${String(firstNumber + index).padStart(3, '0')}`;
      return [
        code, item.full_name, item.date_of_birth, item.gender, item.phone, item.email,
        item.address, item.school_name, item.grade_level, item.status, item.note,
      ];
    });
    const result = await client.query(
      `insert into students
         (student_code, full_name, date_of_birth, gender, phone, email,
          address, school_name, grade_level, status, note)
       values ${placeholders.join(', ')}
       returning student_id, student_code, full_name`,
      values,
    );
    await client.query('commit');
    return success(res, {
      imported_count: result.rowCount,
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
