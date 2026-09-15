const { AppError } = require('./errors');

function validateUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw new AppError(400, 'Tên đăng nhập phải có 3-50 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang');
  }
  return username;
}

function validateFullName(value) {
  const fullName = String(value || '').trim();
  if (fullName.length < 2 || fullName.length > 100) throw new AppError(400, 'Họ và tên phải có 2-100 ký tự');
  return fullName;
}

function validatePhone(value, required = true) {
  const phone = String(value || '').trim();
  if (!phone && !required) return null;
  if (!/^[+0-9][0-9 .()-]{7,19}$/.test(phone)) throw new AppError(400, 'Số điện thoại không hợp lệ');
  return phone;
}

function validateEmail(value) {
  const email = String(value || '').trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'Email không hợp lệ');
  return email;
}

function validatePassword(value) {
  const password = String(value || '');
  if (Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72
      || !/[A-Za-zÀ-ỹ]/.test(password) || !/\d/.test(password)) {
    throw new AppError(400, 'Mật khẩu phải có 8-72 ký tự, gồm ít nhất một chữ và một số');
  }
  return password;
}

function validateRegistration(body) {
  const username = validateUsername(body.username);
  const fullName = validateFullName(body.full_name);
  const phone = validatePhone(body.phone);
  const email = validateEmail(body.email);
  const password = validatePassword(body.password);
  return { username, fullName, phone, email, password };
}

module.exports = {
  validateRegistration, validateUsername, validateFullName,
  validatePhone, validateEmail, validatePassword,
};
