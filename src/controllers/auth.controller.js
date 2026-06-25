const crypto = require('crypto');
const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { signAccessToken } = require('../utils/jwt');
const { success } = require('../utils/response');
const { validateRegistration } = require('../utils/registration');
const { validateFullName, validatePhone, validateEmail } = require('../utils/registration');

function requestMeta(req) {
  return { ip: req.ip || null, userAgent: req.get('user-agent') || null };
}

const register = asyncHandler(async (req, res) => {
  const { username, fullName, phone, email, password } = validateRegistration(req.body);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`register:username:${username}`]);
    if (email) await client.query('select pg_advisory_xact_lock(hashtext($1))', [`register:email:${email}`]);
    const duplicate = await client.query(
      `select 1 from user_accounts
       where lower(username) = $1 or ($2::text is not null and lower(email) = $2)
       limit 1`,
      [username, email],
    );
    if (duplicate.rowCount) throw new AppError(409, 'Tên đăng nhập hoặc email đã được sử dụng');

    const parentResult = await client.query(
      `insert into parents (full_name, phone, email)
       values ($1, $2, $3) returning parent_id`,
      [fullName, phone, email],
    );
    const accountResult = await client.query(
      `insert into user_accounts
         (username, password_hash, full_name, email, phone, role, status, parent_id)
       values ($1, crypt($2, gen_salt('bf')), $3, $4, $5, 'parent', 'active', $6)
       returning user_id, username, full_name, email, phone, role, status, parent_id, created_at`,
      [username, password, fullName, email, phone, parentResult.rows[0].parent_id],
    );
    await client.query('commit');
    return success(res, accountResult.rows[0], 'Đăng ký tài khoản phụ huynh thành công', 201);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) throw new AppError(400, 'username and password are required');
  const normalizedUsername = String(username).trim().toLowerCase();

  const { ip, userAgent } = requestMeta(req);
  const userResult = await pool.query(
    `select user_id, username, full_name, email, phone, role, status,
            teacher_id, student_id, parent_id
     from user_accounts
     where lower(username) = $1 and password_hash = crypt($2, password_hash) and status = 'active'`,
    [normalizedUsername, password],
  );

  if (!userResult.rowCount) {
    const account = await pool.query('select user_id from user_accounts where lower(username) = $1', [normalizedUsername]);
    await pool.query(
      `insert into login_logs (user_id, username_input, success, failure_reason, ip_address, user_agent)
       values ($1, $2, false, $3, $4, $5)`,
      [account.rows[0]?.user_id || null, username, 'Invalid credentials or inactive account', ip, userAgent],
    );
    throw new AppError(401, 'Invalid username or password');
  }

  const user = userResult.rows[0];
  const days = Math.max(Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7, 1);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const sessionResult = await client.query(
      `insert into user_sessions (user_id, ip_address, user_agent, expires_at)
       values ($1, $2, $3, now() + ($4 * interval '1 day')) returning session_id`,
      [user.user_id, ip, userAgent, days],
    );
    const sessionId = sessionResult.rows[0].session_id;
    const token = signAccessToken(user, sessionId);
    await client.query(
      `update user_sessions set refresh_token_hash = encode(digest($1, 'sha256'), 'hex') where session_id = $2`,
      [token, sessionId],
    );
    await client.query('update user_accounts set last_login_at = now(), updated_at = now() where user_id = $1', [user.user_id]);
    await client.query(
      `insert into login_logs (user_id, username_input, success, ip_address, user_agent)
       values ($1, $2, true, $3, $4)`,
      [user.user_id, username, ip, userAgent],
    );
    await client.query('commit');
    return success(res, { token, user }, 'Login successful');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const logout = asyncHandler(async (req, res) => {
  await pool.query(
    `update user_sessions set is_revoked = true, logout_at = now()
     where session_id = $1 and user_id = $2 and is_revoked = false`,
    [req.user.session_id, req.user.user_id],
  );
  return success(res, null, 'Logout successful');
});

const me = asyncHandler(async (req, res) => success(res, req.user, 'Profile fetched successfully'));

const updateMe = asyncHandler(async (req, res) => {
  const changes = {};
  if (req.body.full_name !== undefined) changes.full_name = validateFullName(req.body.full_name);
  if (req.body.phone !== undefined) changes.phone = validatePhone(req.body.phone, false);
  if (req.body.email !== undefined) changes.email = validateEmail(req.body.email);
  const fields = Object.keys(changes);
  if (!fields.length) throw new AppError(400, 'Không có thay đổi hợp lệ');

  const client = await pool.connect();
  try {
    await client.query('begin');
    if (Object.prototype.hasOwnProperty.call(changes, 'email') && changes.email) {
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [`account:email:${changes.email}`]);
      const duplicate = await client.query(
        `select 1 from user_accounts
         where lower(email) = lower($1) and user_id <> $2 limit 1`,
        [changes.email, req.user.user_id],
      );
      if (duplicate.rowCount) throw new AppError(409, 'Email đã được sử dụng');
    }

    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    const values = fields.map((field) => changes[field]);
    values.push(req.user.user_id);
    const result = await client.query(
      `update user_accounts set ${assignments.join(', ')}, updated_at = now()
       where user_id = $${values.length}
       returning user_id, username, full_name, email, phone, role,
                 teacher_id, student_id, parent_id`,
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
      const profileFields = fields.filter((field) => field !== 'email' || updated.role !== 'student');
      if (profileFields.length) {
        const profileAssignments = profileFields.map((field, index) => `${field} = $${index + 1}`);
        await client.query(
          `update ${profile.table} set ${profileAssignments.join(', ')}
           where ${profile.idColumn} = $${profileFields.length + 1}`,
          [...profileFields.map((field) => changes[field]), profile.id],
        );
      }
    }
    await client.query('commit');
    return success(res, updated, 'Cập nhật hồ sơ thành công');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const forgotPassword = asyncHandler(async (req, res) => {
  const identifier = req.body.email || req.body.username;
  if (!identifier) throw new AppError(400, 'email or username is required');
  const result = await pool.query(
    `select user_id from user_accounts where (email = $1 or username = $1) and status = 'active'`,
    [identifier],
  );
  let resetToken;
  if (result.rowCount) {
    resetToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `insert into password_reset_tokens (user_id, token_hash, expires_at)
       values ($1, encode(digest($2, 'sha256'), 'hex'), now() + interval '30 minutes')`,
      [result.rows[0].user_id, resetToken],
    );
  }
  const exposeToken = process.env.NODE_ENV !== 'production' && process.env.EXPOSE_RESET_TOKEN === 'true';
  const data = exposeToken ? { reset_token: resetToken || null } : null;
  return success(res, data, 'If the account exists, password reset instructions have been created');
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, new_password: newPassword } = req.body;
  if (!token || !newPassword) throw new AppError(400, 'token and new_password are required');
  if (newPassword.length < 8) throw new AppError(400, 'new_password must contain at least 8 characters');

  const client = await pool.connect();
  try {
    await client.query('begin');
    const tokenResult = await client.query(
      `select reset_token_id, user_id from password_reset_tokens
       where token_hash = encode(digest($1, 'sha256'), 'hex')
         and used_at is null and expires_at > now() for update`,
      [token],
    );
    if (!tokenResult.rowCount) throw new AppError(400, 'Reset token is invalid or expired');
    const row = tokenResult.rows[0];
    await client.query(
      `update user_accounts set password_hash = crypt($1, gen_salt('bf')), updated_at = now() where user_id = $2`,
      [newPassword, row.user_id],
    );
    await client.query('update password_reset_tokens set used_at = now() where reset_token_id = $1', [row.reset_token_id]);
    await client.query(
      `update user_sessions set is_revoked = true, logout_at = now()
       where user_id = $1 and is_revoked = false`,
      [row.user_id],
    );
    await client.query('commit');
    return success(res, null, 'Password reset successful');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

module.exports = { register, login, logout, me, updateMe, forgotPassword, resetPassword };
