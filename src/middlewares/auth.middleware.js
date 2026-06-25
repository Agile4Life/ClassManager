const pool = require('../config/db');
const { verifyAccessToken } = require('../utils/jwt');
const { AppError } = require('../utils/errors');

async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Authentication token is required');

    const payload = verifyAccessToken(token);
    let result;
    const queryStr = `select ua.user_id, ua.username, ua.full_name, ua.email, ua.phone, ua.role,
              ua.teacher_id, ua.student_id, ua.parent_id, ua.avatar_url, us.session_id
       from user_accounts ua
       join user_sessions us on us.user_id = ua.user_id
       where ua.user_id = $1 and us.session_id = $2 and ua.status = 'active'
         and us.is_revoked = false and us.expires_at > now()`;
    try {
      result = await pool.query(queryStr, [payload.sub, payload.sid]);
    } catch (error) {
      if (error.code === '42703') { // column does not exist
        await pool.query('ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT');
        result = await pool.query(queryStr, [payload.sub, payload.sid]);
      } else {
        throw error;
      }
    }
    if (!result.rowCount) throw new AppError(401, 'Session is invalid or expired');
    req.user = result.rows[0];
    req.token = token;
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError(401, 'Authentication token is invalid or expired'));
  }
}

module.exports = requireAuth;
