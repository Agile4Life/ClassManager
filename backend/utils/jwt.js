const jwt = require('jsonwebtoken');

function getSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return process.env.JWT_SECRET;
}

function signAccessToken(user, sessionId) {
  return jwt.sign(
    {
      sub: String(user.user_id),
      sid: sessionId,
      role: user.role,
      teacher_id: user.teacher_id,
      student_id: user.student_id,
      parent_id: user.parent_id,
    },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signAccessToken, verifyAccessToken };
