const googleLoginUsers = [
  // Thêm các tài khoản Google được phép đăng nhập tại đây, rồi deploy lại.
  // Vai trò hợp lệ: admin, staff, teacher, student, parent.
  // { email: 'teacher@example.com', role: 'teacher' },
  // { email: 'staff@example.com', role: 'staff' },
  { email: 'hoangletran50@gmail.com', role: 'admin' },
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
    throw new Error(`Vai trò Google không hợp lệ cho ${normalizedEmail}: ${item.role}`);
  }
  return { email: normalizedEmail, role };
}

module.exports = { googleLoginUsers, getGoogleLoginUser };
