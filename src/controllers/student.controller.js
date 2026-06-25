const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { success } = require('../utils/response');
const { generateNextCode } = require('../utils/code-generator');
const { normalizeStudentImportRows } = require('../utils/student-import');
const { getPagination } = require('../utils/validation');

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
        parentLinks += 1; console.log('Processed contact');
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

const list = asyncHandler(async (req, res) => {
  const { limit, page, offset } = getPagination(req.query);
  const values = [];
  const conditions = ['s.is_deleted = false'];

  if (req.query.search) {
    values.push(`%${req.query.search}%`);
    conditions.push(`(s.student_code ilike $${values.length} or s.full_name ilike $${values.length} or s.phone ilike $${values.length})`);
  }
  if (req.query.status) {
    values.push(req.query.status);
    conditions.push(`s.status = $${values.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  let countResult;
  try {
    countResult = await pool.query(`select count(*)::int as total from students s ${where}`, values);
  } catch (error) {
    if (error.code === '42703') { // column does not exist
      await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
      countResult = await pool.query(`select count(*)::int as total from students s ${where}`, values);
    } else {
      throw error;
    }
  }
  
  values.push(limit, offset);

  const query = `
    select s.student_id, s.student_code, s.full_name, s.phone as student_phone, s.status,
      max(case when sp.relationship = 'father' then p.phone end) as father_phone,
      max(case when sp.relationship = 'mother' then p.phone end) as mother_phone,
      max(c.class_id) as class_id, max(c.class_name) as class_name
    from students s
    left join student_parents sp on sp.student_id = s.student_id
    left join parents p on p.parent_id = sp.parent_id
    left join enrollments e on e.student_id = s.student_id
    left join classes c on c.class_id = e.class_id
    ${where}
    group by s.student_id
    order by s.student_id desc
    limit $${values.length - 1} offset $${values.length}
  `;
  
  let result;
  try {
    result = await pool.query(query, values);
  } catch (error) {
    if (error.code === '42703') {
      await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
      result = await pool.query(query, values);
    } else {
      throw error;
    }
  }

  return success(res, {
    items: result.rows,
    pagination: { page, limit, total: countResult.rows[0].total },
  }, 'Students fetched successfully');
});

const getById = asyncHandler(async (req, res) => {
  const queryText = `
    select s.student_id, s.student_code, s.full_name, s.phone as student_phone, s.status,
      max(case when sp.relationship = 'father' then p.phone end) as father_phone,
      max(case when sp.relationship = 'mother' then p.phone end) as mother_phone,
      max(c.class_id) as class_id, max(c.class_name) as class_name
    from students s
    left join student_parents sp on sp.student_id = s.student_id
    left join parents p on p.parent_id = sp.parent_id
    left join enrollments e on e.student_id = s.student_id
    left join classes c on c.class_id = e.class_id
    where s.student_id = $1 and s.is_deleted = false
    group by s.student_id
  `;
  let result;
  try {
    result = await pool.query(queryText, [req.params.id]);
  } catch (error) {
    if (error.code === '42703') {
      await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
      result = await pool.query(queryText, [req.params.id]);
    } else {
      throw error;
    }
  }
  if (!result.rowCount) throw new AppError(404, 'Record not found');
  return success(res, result.rows[0], 'Record fetched successfully');
});

const create = asyncHandler(async (req, res) => {
  const { full_name, status, student_phone, father_phone, mother_phone, class_id } = req.body;
  if (!full_name) throw new AppError(400, 'full_name is required');

  const client = await pool.connect();
  try {
    await client.query('begin');
    const student_code = await generateNextCode(client, { table: 'students', column: 'student_code', prefix: 'S', digits: 3 });
    const result = await client.query(
      `insert into students (student_code, full_name, status, phone) values ($1, $2, $3, $4) returning student_id, student_code, full_name, status, phone as student_phone`,
      [student_code, full_name, status || 'active', student_phone || null]
    );
    const student = result.rows[0];

    const contacts = [
      { phone: father_phone, relationship: 'father' },
      { phone: mother_phone, relationship: 'mother' },
    ].filter((contact) => contact.phone);
    const primaryRelationship = contacts.some((contact) => contact.relationship === 'mother') ? 'mother' : 'father';
    for (const contact of contacts) {
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [`parent-contact:${contact.relationship}:${contact.phone}`]);
      const parentId = await getOrCreateParent(client, { ...contact, studentName: full_name });
      await client.query(
        `insert into student_parents (student_id, parent_id, relationship, is_primary_contact) values ($1, $2, $3, $4)`,
        [student.student_id, parentId, contact.relationship, contact.relationship === primaryRelationship]
      );
    }
    
    if (class_id) {
      await client.query(`insert into enrollments (student_id, class_id) values ($1, $2)`, [student.student_id, class_id]);
    }

    await client.query('commit');
    return success(res, { ...student, father_phone, mother_phone, class_id }, 'Record created successfully', 201);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const update = asyncHandler(async (req, res) => {
  const { full_name, status, student_phone, father_phone, mother_phone, class_id } = req.body;
  if (!full_name) throw new AppError(400, 'full_name is required');

  const client = await pool.connect();
  try {
    await client.query('begin');
    let result;
    try {
      result = await client.query(
        `update students set full_name = $1, status = $2, phone = $3 where student_id = $4 and is_deleted = false returning student_id, student_code, full_name, status, phone as student_phone`,
        [full_name, status || 'active', student_phone || null, req.params.id]
      );
    } catch (error) {
      if (error.code === '42703') {
        await client.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
        result = await client.query(
          `update students set full_name = $1, status = $2, phone = $3 where student_id = $4 and is_deleted = false returning student_id, student_code, full_name, status, phone as student_phone`,
          [full_name, status || 'active', student_phone || null, req.params.id]
        );
      } else {
        throw error;
      }
    }
    await client.query('update user_accounts set full_name = $1, phone = $2 where student_id = $3', [full_name, student_phone || null, req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'Record not found');
    const student = result.rows[0];

    await client.query(`delete from student_parents where student_id = $1`, [student.student_id]);

    const contacts = [
      { phone: father_phone, relationship: 'father' },
      { phone: mother_phone, relationship: 'mother' },
    ].filter((contact) => contact.phone);
    const primaryRelationship = contacts.some((contact) => contact.relationship === 'mother') ? 'mother' : 'father';
    for (const contact of contacts) {
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [`parent-contact:${contact.relationship}:${contact.phone}`]);
      const parentId = await getOrCreateParent(client, { ...contact, studentName: full_name });
      await client.query(
        `insert into student_parents (student_id, parent_id, relationship, is_primary_contact) values ($1, $2, $3, $4)`,
        [student.student_id, parentId, contact.relationship, contact.relationship === primaryRelationship]
      );
    }
    
    await client.query(`delete from enrollments where student_id = $1`, [student.student_id]);
    if (class_id) {
      await client.query(`insert into enrollments (student_id, class_id) values ($1, $2)`, [student.student_id, class_id]);
    }

    await client.query('commit');
    return success(res, { ...student, father_phone, mother_phone, class_id }, 'Record updated successfully');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const remove = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await pool.query(`update students set is_deleted = true where student_id = $1 returning student_id`, [req.params.id]);
  } catch (error) {
    if (error.code === '42703') {
      await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
      result = await pool.query(`update students set is_deleted = true where student_id = $1 returning student_id`, [req.params.id]);
    } else {
      throw error;
    }
  }
  if (!result.rowCount) throw new AppError(404, 'Record not found');
  
  // Update related user accounts if any to inactive or maybe just leave them?
  // User asked for soft delete and hide from list, so updating students is enough.
  return success(res, result.rows[0], 'Record deleted successfully');
});

const bulkAssignClass = asyncHandler(async (req, res) => {
  const { student_ids, class_id } = req.body;
  if (!Array.isArray(student_ids) || student_ids.length === 0) {
    throw new AppError(400, 'student_ids must be a non-empty array');
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`delete from enrollments where student_id = any($1::bigint[])`, [student_ids]);
    
    if (class_id) {
      await client.query(
        `insert into enrollments (student_id, class_id) select unnest($1::bigint[]), $2`,
        [student_ids, class_id]
      );
    }
    
    await client.query('commit');
    return success(res, { count: student_ids.length }, 'Students assigned to class successfully');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

module.exports = { list, getById, create, update, remove, importStudents, bulkAssignClass };
