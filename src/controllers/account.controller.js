const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { getPagination } = require('../utils/validation');
const { success } = require('../utils/response');
const {
  validateUsername, validateFullName, validatePhone, validateEmail, validatePassword,
} = require('../utils/registration');

const ROLES = ['admin', 'staff', 'teacher', 'student', 'parent'];
const STATUSES = ['active', 'inactive', 'locked'];
const LINK_CONFIG = {
  teacher: { table: 'teachers', idColumn: 'teacher_id' },
  student: { table: 'students', idColumn: 'student_id' },
  parent: { table: 'parents', idColumn: 'parent_id' },
};

async function lockAndAssertUnique(client, { username, email, excludeUserId = null }) {
  if (username) await client.query('select pg_advisory_xact_lock(hashtext($1))', [`account:username:${username}`]);
  if (email) await client.query('select pg_advisory_xact_lock(hashtext($1))', [`account:email:${email}`]);
  const values = [username || null, email || null, excludeUserId];
  const duplicate = await client.query(
    `select 1 from user_accounts
     where (($1::text is not null and lower(username) = $1)
        or ($2::text is not null and lower(email) = $2))
       and ($3::bigint is null or user_id <> $3)
     limit 1`,
    values,
  );
  if (duplicate.rowCount) throw new AppError(409, 'Tên đăng nhập hoặc email đã được sử dụng');
}

const listAccounts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 15);
  const values = [];
  const conditions = [];
  if (req.query.search) {
    values.push(`%${req.query.search.trim()}%`);
    conditions.push(`(ua.username ilike $${values.length} or ua.full_name ilike $${values.length}
      or ua.email ilike $${values.length} or ua.phone ilike $${values.length})`);
  }
  if (req.query.role) {
    if (!ROLES.includes(req.query.role)) throw new AppError(400, 'Vai trò không hợp lệ');
    values.push(req.query.role); conditions.push(`ua.role = $${values.length}`);
  }
  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) throw new AppError(400, 'Trạng thái không hợp lệ');
    values.push(req.query.status); conditions.push(`ua.status = $${values.length}`);
  }
  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const countResult = await pool.query(`select count(*)::int as total from user_accounts ua ${where}`, values);
  const summaryResult = await pool.query(
    `select count(*)::int as total,
            count(*) filter (where status = 'active')::int as active,
            count(*) filter (where status = 'locked')::int as locked,
            count(*) filter (where role = 'admin')::int as admins
     from user_accounts`,
  );
  const listValues = [...values, limit, offset];
  const result = await pool.query(
    `select ua.user_id, ua.username, ua.full_name, ua.email, ua.phone, ua.role, ua.status,
            ua.teacher_id, ua.student_id, ua.parent_id, ua.last_login_at, ua.created_at,
            coalesce(t.full_name, s.full_name, p.full_name) as linked_profile_name,
            coalesce(t.teacher_code, s.student_code) as linked_profile_code
     from user_accounts ua
     left join teachers t on t.teacher_id = ua.teacher_id
     left join students s on s.student_id = ua.student_id
     left join parents p on p.parent_id = ua.parent_id
     ${where}
     order by ua.created_at desc, ua.user_id desc
     limit $${listValues.length - 1} offset $${listValues.length}`,
    listValues,
  );
  return success(res, {
    items: result.rows,
    summary: summaryResult.rows[0],
    pagination: { page, limit, total: countResult.rows[0].total },
  }, 'Accounts fetched successfully');
});

const getReferences = asyncHandler(async (req, res) => {
  const [teachers, students, parents] = await Promise.all([
    pool.query(
      `select t.teacher_id as id, t.teacher_code as code, t.full_name, t.email, t.phone, t.status
       from teachers t left join user_accounts ua on ua.teacher_id = t.teacher_id
       where ua.user_id is null order by t.full_name limit 500`,
    ),
    pool.query(
      `select s.student_id as id, s.student_code as code, s.full_name, s.email, s.phone, s.status
       from students s left join user_accounts ua on ua.student_id = s.student_id
       where ua.user_id is null order by s.full_name limit 500`,
    ),
    pool.query(
      `select p.parent_id as id, null::text as code, p.full_name, p.email, p.phone, 'active'::text as status
       from parents p left join user_accounts ua on ua.parent_id = p.parent_id
       where ua.user_id is null order by p.full_name limit 500`,
    ),
  ]);
  return success(res, {
    teacher: teachers.rows, student: students.rows, parent: parents.rows,
  }, 'Account references fetched successfully');
});

const createAccount = asyncHandler(async (req, res) => {
  const role = String(req.body.role || '');
  if (!ROLES.includes(role)) throw new AppError(400, 'Vai trò không hợp lệ');
  const username = validateUsername(req.body.username);
  const password = validatePassword(req.body.password);
  const status = req.body.status || 'active';
  if (!STATUSES.includes(status)) throw new AppError(400, 'Trạng thái không hợp lệ');

  const client = await pool.connect();
  try {
    await client.query('begin');
    let fullName;
    let phone;
    let email;
    let linkColumn = null;
    let linkId = null;
    const link = LINK_CONFIG[role];
    if (link) {
      linkColumn = link.idColumn;
      linkId = req.body[linkColumn];
      if (!linkId || !/^\d+$/.test(String(linkId))) throw new AppError(400, `Cần chọn hồ sơ ${role}`);
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [`account-link:${role}:${linkId}`]);
      const profile = await client.query(
        `select ${link.idColumn} as id, full_name, phone, email from ${link.table} where ${link.idColumn} = $1`,
        [linkId],
      );
      if (!profile.rowCount) throw new AppError(404, 'Không tìm thấy hồ sơ được liên kết');
      const used = await client.query(`select 1 from user_accounts where ${linkColumn} = $1`, [linkId]);
      if (used.rowCount) throw new AppError(409, 'Hồ sơ này đã có tài khoản');
      fullName = profile.rows[0].full_name;
      phone = profile.rows[0].phone || null;
      email = validateEmail(profile.rows[0].email);
    } else {
      fullName = validateFullName(req.body.full_name);
      phone = validatePhone(req.body.phone, false);
      email = validateEmail(req.body.email);
    }
    await lockAndAssertUnique(client, { username, email });

    const linkColumns = linkColumn ? `, ${linkColumn}` : '';
    const linkPlaceholder = linkColumn ? ', $9' : '';
    const params = [username, password, fullName, email, phone, role, status, new Date()];
    if (linkColumn) params.push(linkId);
    const result = await client.query(
      `insert into user_accounts
         (username, password_hash, full_name, email, phone, role, status, updated_at${linkColumns})
       values ($1, crypt($2, gen_salt('bf')), $3, $4, $5, $6, $7, $8${linkPlaceholder})
       returning user_id, username, full_name, email, phone, role, status,
                 teacher_id, student_id, parent_id, created_at`,
      params,
    );
    await client.query('commit');
    return success(res, result.rows[0], 'Tạo tài khoản thành công', 201);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const updateAccount = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const existing = await pool.query('select * from user_accounts where user_id = $1', [userId]);
  if (!existing.rowCount) throw new AppError(404, 'Không tìm thấy tài khoản');
  if (String(userId) === String(req.user.user_id) && req.body.status && req.body.status !== 'active') {
    throw new AppError(400, 'Bạn không thể khóa tài khoản đang đăng nhập');
  }

  const changes = {};
  if (req.body.username !== undefined) changes.username = validateUsername(req.body.username);
  if (req.body.full_name !== undefined) changes.full_name = validateFullName(req.body.full_name);
  if (req.body.email !== undefined) changes.email = validateEmail(req.body.email);
  if (req.body.phone !== undefined) changes.phone = validatePhone(req.body.phone, false);
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) throw new AppError(400, 'Trạng thái không hợp lệ');
    changes.status = req.body.status;
  }
  const fields = Object.keys(changes);
  if (!fields.length) throw new AppError(400, 'Không có thay đổi hợp lệ');

  const client = await pool.connect();
  try {
    await client.query('begin');
    await lockAndAssertUnique(client, {
      username: changes.username || null,
      email: Object.prototype.hasOwnProperty.call(changes, 'email') ? changes.email : null,
      excludeUserId: userId,
    });
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    const values = fields.map((field) => changes[field]);
    values.push(userId);
    const result = await client.query(
      `update user_accounts set ${assignments.join(', ')}, updated_at = now()
       where user_id = $${values.length}
       returning user_id, username, full_name, email, phone, role, status,
                 teacher_id, student_id, parent_id, last_login_at, created_at`,
      values,
    );
    if (changes.status && changes.status !== 'active') {
      await client.query(
        `update user_sessions set is_revoked = true, logout_at = now()
         where user_id = $1 and is_revoked = false`,
        [userId],
      );
    }
    await client.query('commit');
    return success(res, result.rows[0], 'Cập nhật tài khoản thành công');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const resetAccountPassword = asyncHandler(async (req, res) => {
  const password = validatePassword(req.body.password);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `update user_accounts set password_hash = crypt($1, gen_salt('bf')), updated_at = now()
       where user_id = $2 returning user_id`,
      [password, req.params.userId],
    );
    if (!result.rowCount) throw new AppError(404, 'Không tìm thấy tài khoản');
    const keepSessionId = String(req.params.userId) === String(req.user.user_id) ? req.user.session_id : null;
    await client.query(
      `update user_sessions set is_revoked = true, logout_at = now()
       where user_id = $1 and is_revoked = false
         and ($2::uuid is null or session_id <> $2::uuid)`,
      [req.params.userId, keepSessionId],
    );
    await client.query('commit');
    return success(res, result.rows[0], 'Đặt lại mật khẩu thành công');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const deleteAccount = asyncHandler(async (req, res) => {
  if (String(req.params.userId) === String(req.user.user_id)) throw new AppError(400, 'Bạn không thể xóa tài khoản đang đăng nhập');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const target = await client.query('select user_id, role from user_accounts where user_id = $1 for update', [req.params.userId]);
    if (!target.rowCount) throw new AppError(404, 'Không tìm thấy tài khoản');
    if (target.rows[0].role === 'admin') {
      const otherAdmins = await client.query("select 1 from user_accounts where role = 'admin' and user_id <> $1 limit 1", [req.params.userId]);
      if (!otherAdmins.rowCount) throw new AppError(400, 'Không thể xóa quản trị viên cuối cùng');
    }
    const result = await client.query('delete from user_accounts where user_id = $1 returning user_id', [req.params.userId]);
    await client.query('commit');
    return success(res, result.rows[0], 'Xóa tài khoản thành công');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

module.exports = {
  listAccounts, getReferences, createAccount, updateAccount, resetAccountPassword, deleteAccount,
};
