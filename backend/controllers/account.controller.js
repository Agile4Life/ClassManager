const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { getPagination } = require('../utils/validation');
const { success } = require('../utils/response');
const {
  validateUsername, validateFullName, validatePhone, validateEmail, validatePassword,
} = require('../utils/registration');
const { generateNextCode } = require('../utils/code-generator');

const ROLES = ['admin', 'staff', 'teacher', 'student', 'parent'];
const STATUSES = ['active', 'inactive', 'locked'];
const LINK_CONFIG = {
  teacher: {
    table: 'teachers',
    idColumn: 'teacher_id',
    codeColumn: 'teacher_code',
    codePrefix: 'T',
    availableCondition: 'profile.is_deleted = false',
  },
  student: { table: 'students', idColumn: 'student_id', codeColumn: 'student_code', codePrefix: 'S' },
  parent: { table: 'parents', idColumn: 'parent_id' },
};

async function findOrCreateProfile(client, role, { fullName, phone, email }) {
  const config = LINK_CONFIG[role];
  if (!config) return { linkColumn: null, linkId: null };

  const identity = email || phone || fullName.toLocaleLowerCase('vi');
  await client.query('select pg_advisory_xact_lock(hashtext($1))', [`account-profile:${role}:${identity}`]);

  const contactConditions = [];
  const values = [fullName];
  if (email) {
    values.push(email);
    contactConditions.push(`lower(profile.email) = $${values.length}`);
  }
  if (phone) {
    values.push(phone);
    contactConditions.push(`profile.phone = $${values.length}`);
  }

  if (contactConditions.length) {
    const availability = config.availableCondition ? `and ${config.availableCondition}` : '';
    const existing = await client.query(
      `select profile.${config.idColumn} as id
       from ${config.table} profile
       left join user_accounts account on account.${config.idColumn} = profile.${config.idColumn}
       where account.user_id is null and lower(profile.full_name) = lower($1)
         ${availability}
         and (${contactConditions.join(' or ')})
       order by profile.${config.idColumn}
       limit 1`,
      values,
    );
    if (existing.rowCount) return { linkColumn: config.idColumn, linkId: existing.rows[0].id };
  }

  const availability = config.availableCondition ? `and ${config.availableCondition}` : '';
  const sameName = await client.query(
    `select profile.${config.idColumn} as id
     from ${config.table} profile
     left join user_accounts account on account.${config.idColumn} = profile.${config.idColumn}
     where account.user_id is null and lower(profile.full_name) = lower($1)
       ${availability}
     order by profile.${config.idColumn}
     limit 2`,
    [fullName],
  );
  if (sameName.rowCount === 1) return { linkColumn: config.idColumn, linkId: sameName.rows[0].id };

  let created;
  if (config.codeColumn) {
    const code = await generateNextCode(client, {
      table: config.table, column: config.codeColumn, prefix: config.codePrefix, digits: 3,
    });
    created = await client.query(
      `insert into ${config.table} (${config.codeColumn}, full_name, phone, email)
       values ($1, $2, $3, $4) returning ${config.idColumn} as id`,
      [code, fullName, phone, email],
    );
  } else {
    created = await client.query(
      `insert into ${config.table} (full_name, phone, email)
       values ($1, $2, $3) returning ${config.idColumn} as id`,
      [fullName, phone, email],
    );
  }
  return { linkColumn: config.idColumn, linkId: created.rows[0].id };
}

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

async function assertTeacherAvailable(client, teacherId) {
  if (!teacherId) return;
  const result = await client.query(
    'select 1 from teachers where teacher_id = $1 and is_deleted = false',
    [teacherId],
  );
  if (!result.rowCount) throw new AppError(400, 'Teacher does not exist or has been deleted');
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
     left join teachers t on t.teacher_id = ua.teacher_id and t.is_deleted = false
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
    const fullName = validateFullName(req.body.full_name);
    const phone = validatePhone(req.body.phone, role === 'parent');
    const email = validateEmail(req.body.email);
    await lockAndAssertUnique(client, { username, email });
    const { linkColumn, linkId } = await findOrCreateProfile(client, role, { fullName, phone, email });

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
  if (req.body.teacher_id !== undefined) changes.teacher_id = req.body.teacher_id || null;
  if (req.body.student_id !== undefined) changes.student_id = req.body.student_id || null;
  if (req.body.parent_id !== undefined) changes.parent_id = req.body.parent_id || null;
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
    if (Object.prototype.hasOwnProperty.call(changes, 'teacher_id')) {
      await assertTeacherAvailable(client, changes.teacher_id);
    }
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
    const updated = result.rows[0];
    const profileMap = {
      teacher: { table: 'teachers', idColumn: 'teacher_id', id: updated.teacher_id },
      student: { table: 'students', idColumn: 'student_id', id: updated.student_id },
      parent: { table: 'parents', idColumn: 'parent_id', id: updated.parent_id },
    };
    const profile = profileMap[updated.role];
    if (profile?.id) {
      const profileFields = fields.filter((field) => ['full_name', 'phone', 'email'].includes(field) && (field !== 'email' || updated.role !== 'student'));
      if (profileFields.length) {
        const profileAssignments = profileFields.map((field, index) => `${field} = $${index + 1}`);
        await client.query(
          `update ${profile.table} set ${profileAssignments.join(', ')}
           where ${profile.idColumn} = $${profileFields.length + 1}`,
          [...profileFields.map((field) => changes[field]), profile.id],
        );
      }
    }
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
  listAccounts, createAccount, updateAccount, resetAccountPassword, deleteAccount,
};
