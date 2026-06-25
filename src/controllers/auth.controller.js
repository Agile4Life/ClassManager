const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { AppError } = require('../utils/errors');
const { signAccessToken } = require('../utils/jwt');
const { success } = require('../utils/response');
const { validateRegistration } = require('../utils/registration');
const {
  validateFullName, validatePhone, validateEmail, validateUsername,
} = require('../utils/registration');
const { generateNextCode } = require('../utils/code-generator');
const { getGoogleLoginUser } = require('../config/google-login-users');

function requestMeta(req) {
  return { ip: req.ip || null, userAgent: req.get('user-agent') || null };
}

function userSelectColumns() {
  return `user_id, username, full_name, email, phone, role, status,
          teacher_id, student_id, parent_id, avatar_url`;
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) throw new AppError(500, 'JWT_SECRET is required');
  return process.env.JWT_SECRET;
}

function signGoogleSetupToken(profile, role) {
  return jwt.sign(
    {
      typ: 'google_setup',
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      role,
    },
    getJwtSecret(),
    { expiresIn: '15m' },
  );
}

function verifyGoogleSetupToken(token) {
  if (!token) throw new AppError(400, 'Google setup token is required');
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (payload.typ !== 'google_setup' || !payload.sub || !payload.email || !payload.role) {
      throw new Error('Invalid setup token');
    }
    return payload;
  } catch (error) {
    throw new AppError(401, 'Google setup token is invalid or expired');
  }
}

function setupFieldsForRole(role) {
  const common = [
    { name: 'full_name', label: 'Ho va ten', required: true },
  ];
  if (role === 'parent') {
    return [
      ...common,
      { name: 'phone', label: 'So dien thoai', required: true },
      { name: 'address', label: 'Dia chi', required: false },
      { name: 'occupation', label: 'Nghe nghiep', required: false },
    ];
  }
  if (role === 'teacher') {
    return [
      ...common,
      { name: 'phone', label: 'So dien thoai', required: false },
      { name: 'specialization', label: 'Chuyen mon', required: false },
    ];
  }
  if (role === 'student') {
    return [
      ...common,
      { name: 'phone', label: 'So dien thoai', required: false },
      { name: 'grade_level', label: 'Khoi lop', required: false },
      { name: 'school_name', label: 'Truong hoc', required: false },
    ];
  }
  return [
    ...common,
    { name: 'phone', label: 'So dien thoai', required: false },
  ];
}

async function ensureGoogleLoginColumns(client = pool) {
  await client.query('ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT');
  await client.query('ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS google_sub TEXT');
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accounts_google_sub ON user_accounts(google_sub) WHERE google_sub IS NOT NULL');
}

async function createLoginSession(client, user, usernameInput, req) {
  const { ip, userAgent } = requestMeta(req);
  const days = Math.max(Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7, 1);
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
    [user.user_id, usernameInput, ip, userAgent],
  );
  return { token, user };
}

async function verifyGoogleCredential(credential) {
  if (!credential) throw new AppError(400, 'Google credential is required');
  if (!process.env.GOOGLE_CLIENT_ID) throw new AppError(500, 'GOOGLE_CLIENT_ID is not configured');

  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    throw new AppError(401, 'Google credential is invalid or expired');
  }
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) throw new AppError(401, 'Google account information is incomplete');
  if (payload.email_verified !== true) throw new AppError(401, 'Google email is not verified');

  return {
    sub: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    name: payload.name || payload.email,
    picture: payload.picture || null,
  };
}

function normalizeOptionalText(value, maxLength = 150) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function buildUsernameFromEmail(email) {
  const localPart = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9._-]+/g, '.');
  const trimmed = localPart.replace(/^[._-]+|[._-]+$/g, '').slice(0, 42);
  return trimmed || 'google.user';
}

async function generateAvailableUsername(client, email) {
  const base = validateUsername(buildUsernameFromEmail(email).padEnd(3, '0'));
  for (let index = 0; index < 100; index += 1) {
    const suffix = index ? String(index) : '';
    const username = `${base.slice(0, 50 - suffix.length)}${suffix}`;
    const duplicate = await client.query('select 1 from user_accounts where lower(username) = $1 limit 1', [username]);
    if (!duplicate.rowCount) return username;
  }
  return `google.${Date.now()}`.slice(0, 50);
}

async function assertProfileNotLinked(client, column, value) {
  if (!value) return;
  const linked = await client.query(`select 1 from user_accounts where ${column} = $1 limit 1`, [value]);
  if (linked.rowCount) throw new AppError(409, 'Ho so nay da duoc lien ket voi tai khoan khac');
}

async function createLinkedProfile(client, role, profile, details) {
  const fullName = validateFullName(details.full_name || profile.name);
  const phone = role === 'parent'
    ? validatePhone(details.phone, true)
    : validatePhone(details.phone, false);
  if (role === 'admin' || role === 'staff') return { fullName, phone };

  if (role === 'parent') {
    let existing = await client.query(
      `select parent_id from parents
       where lower(coalesce(email, '')) = $1 or phone = $2
       order by parent_id limit 1`,
      [profile.email, phone],
    );
    let parentId;
    if (existing.rowCount) {
      parentId = existing.rows[0].parent_id;
      await client.query(
        `update parents
         set full_name = coalesce(nullif($1, ''), full_name),
             email = coalesce(email, $2),
             address = coalesce($3, address),
             occupation = coalesce($4, occupation)
         where parent_id = $5`,
        [
          fullName,
          profile.email,
          normalizeOptionalText(details.address, 300),
          normalizeOptionalText(details.occupation, 100),
          parentId,
        ],
      );
    } else {
      existing = await client.query(
        `insert into parents (full_name, phone, email, address, occupation)
         values ($1, $2, $3, $4, $5) returning parent_id`,
        [
          fullName,
          phone,
          profile.email,
          normalizeOptionalText(details.address, 300),
          normalizeOptionalText(details.occupation, 100),
        ],
      );
      parentId = existing.rows[0].parent_id;
    }
    await assertProfileNotLinked(client, 'parent_id', parentId);
    return { fullName, phone, parent_id: parentId };
  }

  if (role === 'teacher') {
    let existing = await client.query(
      `select teacher_id from teachers where lower(email) = $1 order by teacher_id limit 1`,
      [profile.email],
    );
    let teacherId;
    if (existing.rowCount) {
      teacherId = existing.rows[0].teacher_id;
      await client.query(
        `update teachers
         set full_name = $1,
             phone = coalesce($2, phone),
             specialization = coalesce($3, specialization),
             is_deleted = false,
             status = 'active'
         where teacher_id = $4`,
        [fullName, phone, normalizeOptionalText(details.specialization, 100), teacherId],
      );
    } else {
      const teacherCode = await generateNextCode(client, {
        table: 'teachers', column: 'teacher_code', prefix: 'T', digits: 3,
      });
      existing = await client.query(
        `insert into teachers (teacher_code, full_name, phone, email, specialization, status)
         values ($1, $2, $3, $4, $5, 'active') returning teacher_id`,
        [teacherCode, fullName, phone, profile.email, normalizeOptionalText(details.specialization, 100)],
      );
      teacherId = existing.rows[0].teacher_id;
    }
    await assertProfileNotLinked(client, 'teacher_id', teacherId);
    return { fullName, phone, teacher_id: teacherId };
  }

  if (role === 'student') {
    const studentCode = await generateNextCode(client, {
      table: 'students', column: 'student_code', prefix: 'S', digits: 3,
    });
    const result = await client.query(
      `insert into students (student_code, full_name, phone, email, grade_level, school_name, status)
       values ($1, $2, $3, $4, $5, $6, 'active') returning student_id`,
      [
        studentCode,
        fullName,
        phone,
        profile.email,
        normalizeOptionalText(details.grade_level, 30),
        normalizeOptionalText(details.school_name, 150),
      ],
    );
    return { fullName, phone, student_id: result.rows[0].student_id };
  }

  throw new AppError(400, 'Vai tro Google khong hop le');
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
  let userResult;
  const loginQuery = `select ${userSelectColumns()}
     from user_accounts
     where lower(username) = $1 and password_hash = crypt($2, password_hash) and status = 'active'`;
  try {
    userResult = await pool.query(loginQuery, [normalizedUsername, password]);
  } catch (error) {
    if (error.code === '42703') {
      await pool.query('ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT');
      userResult = await pool.query(loginQuery, [normalizedUsername, password]);
    } else {
      throw error;
    }
  }

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
  const client = await pool.connect();
  try {
    await client.query('begin');
    const data = await createLoginSession(client, user, username, req);
    await client.query('commit');
    return success(res, data, 'Login successful');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const googleLogin = asyncHandler(async (req, res) => {
  const profile = await verifyGoogleCredential(req.body.credential);
  const { ip, userAgent } = requestMeta(req);
  const client = await pool.connect();
  let transactionFinished = false;
  try {
    await client.query('begin');
    await ensureGoogleLoginColumns(client);
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`google:sub:${profile.sub}`]);
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`google:email:${profile.email}`]);

    const accountResult = await client.query(
      `select ${userSelectColumns()}, google_sub
       from user_accounts
       where status = 'active'
         and (google_sub = $1 or lower(email) = $2)
       order by case when google_sub = $1 then 0 else 1 end
       limit 1`,
      [profile.sub, profile.email],
    );

    if (!accountResult.rowCount) {
      const configuredUser = getGoogleLoginUser(profile.email);
      if (configuredUser) {
        await client.query('commit');
        transactionFinished = true;
        return success(res, {
          needs_profile: true,
          setup_token: signGoogleSetupToken(profile, configuredUser.role),
          role: configuredUser.role,
          email: profile.email,
          full_name: profile.name,
          avatar_url: profile.picture,
          fields: setupFieldsForRole(configuredUser.role),
        }, 'Google profile setup required', 202);
      }

      await client.query(
        `insert into login_logs (user_id, username_input, success, failure_reason, ip_address, user_agent)
         values (null, $1, false, $2, $3, $4)`,
        [profile.email, 'Google email is not allowed or linked to an active account', ip, userAgent],
      );
      await client.query('commit');
      transactionFinished = true;
      throw new AppError(404, 'Email Google nay chua duoc cap quyen dang nhap ClassManager.');
    }

    const account = accountResult.rows[0];
    if (account.google_sub && account.google_sub !== profile.sub) {
      await client.query(
        `insert into login_logs (user_id, username_input, success, failure_reason, ip_address, user_agent)
         values ($1, $2, false, $3, $4, $5)`,
        [account.user_id, profile.email, 'Google account mismatch for this email', ip, userAgent],
      );
      await client.query('commit');
      transactionFinished = true;
      throw new AppError(409, 'Email này đã được liên kết với một tài khoản Google khác.');
    }

    const linkedResult = await client.query(
      `update user_accounts
       set google_sub = coalesce(google_sub, $1),
           avatar_url = coalesce($2, avatar_url),
           updated_at = now()
       where user_id = $3
       returning ${userSelectColumns()}`,
      [profile.sub, profile.picture, account.user_id],
    );
    const data = await createLoginSession(client, linkedResult.rows[0], profile.email, req);
    await client.query('commit');
    transactionFinished = true;
    return success(res, data, 'Google login successful');
  } catch (error) {
    if (!transactionFinished) await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

const completeGoogleProfile = asyncHandler(async (req, res) => {
  const setup = verifyGoogleSetupToken(req.body.setup_token);
  const configuredUser = getGoogleLoginUser(setup.email);
  if (!configuredUser || configuredUser.role !== setup.role) {
    throw new AppError(403, 'Email Google nay khong con duoc cap quyen voi vai tro nay');
  }

  const { ip, userAgent } = requestMeta(req);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await ensureGoogleLoginColumns(client);
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`google:sub:${setup.sub}`]);
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`google:email:${setup.email}`]);

    const duplicate = await client.query(
      `select 1 from user_accounts
       where google_sub = $1 or lower(email) = $2
       limit 1`,
      [setup.sub, setup.email],
    );
    if (duplicate.rowCount) throw new AppError(409, 'Tai khoan Google nay da duoc tao. Hay dang nhap lai.');

    const profile = {
      sub: setup.sub,
      email: setup.email,
      name: setup.name || setup.email,
      picture: setup.picture || null,
    };
    const details = req.body.profile || {};
    const linked = await createLinkedProfile(client, setup.role, profile, details);
    const username = await generateAvailableUsername(client, setup.email);
    const password = crypto.randomBytes(32).toString('base64url');

    const accountResult = await client.query(
      `insert into user_accounts
         (username, password_hash, full_name, email, phone, role, status,
          teacher_id, student_id, parent_id, google_sub, avatar_url)
       values ($1, crypt($2, gen_salt('bf')), $3, $4, $5, $6, 'active',
          $7, $8, $9, $10, $11)
       returning ${userSelectColumns()}`,
      [
        username,
        password,
        linked.fullName,
        setup.email,
        linked.phone || null,
        setup.role,
        linked.teacher_id || null,
        linked.student_id || null,
        linked.parent_id || null,
        setup.sub,
        setup.picture || null,
      ],
    );

    const data = await createLoginSession(client, accountResult.rows[0], setup.email, req);
    await client.query('commit');
    return success(res, data, 'Google profile created successfully', 201);
  } catch (error) {
    await client.query('rollback');
    if (!(error instanceof AppError)) {
      await pool.query(
        `insert into login_logs (user_id, username_input, success, failure_reason, ip_address, user_agent)
         values (null, $1, false, $2, $3, $4)`,
        [setup.email, error.message || 'Google profile setup failed', ip, userAgent],
      ).catch(() => {});
    }
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
  if (req.body.avatar_url !== undefined) changes.avatar_url = req.body.avatar_url;
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
    let result;
    const updateQuery = `update user_accounts set ${assignments.join(', ')}, updated_at = now()
       where user_id = $${values.length}
       returning user_id, username, full_name, email, phone, role,
                 teacher_id, student_id, parent_id, avatar_url`;
    try {
      result = await client.query(updateQuery, values);
    } catch (error) {
      if (error.code === '42703') {
        await client.query('ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT');
        result = await client.query(updateQuery, values);
      } else {
        throw error;
      }
    }
    const updated = result.rows[0];
    const profileMap = {
      teacher: { table: 'teachers', idColumn: 'teacher_id', id: updated.teacher_id },
      student: { table: 'students', idColumn: 'student_id', id: updated.student_id },
      parent: { table: 'parents', idColumn: 'parent_id', id: updated.parent_id },
    };
    const profile = profileMap[updated.role];
    if (profile?.id) {
      const profileFields = fields.filter((field) => field !== 'email' && field !== 'avatar_url' || (field === 'email' && updated.role !== 'student'));
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

module.exports = {
  register,
  login,
  googleLogin,
  completeGoogleProfile,
  logout,
  me,
  updateMe,
  forgotPassword,
  resetPassword,
};
