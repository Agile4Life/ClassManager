const googleLoginUsers = [
  
  // { email: 'teacher@example.com', role: 'teacher' },
  // { email: 'staff@example.com', role: 'staff' },
  
];

const allowedRoles = new Set(['admin', 'staff', 'teacher', 'student', 'parent']);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getGoogleLoginUser(email) {
  const normalizedEmail = normalizeEmail(email);
  const item = googleLoginUsers.find((entry) => normalizeEmail(entry.email) === normalizedEmail);
  if (!item) return null;
  const role = String(item.role || '').trim().toLowerCase();
  if (!allowedRoles.has(role)) {
    throw new Error(`Invalid Google login role for ${normalizedEmail}: ${item.role}`);
  }
  return { email: normalizedEmail, role };
}

module.exports = { googleLoginUsers, getGoogleLoginUser };
