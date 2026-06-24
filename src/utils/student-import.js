const { isIsoDate } = require('./validation');

const GENDERS = ['male', 'female', 'other'];
const STATUSES = ['active', 'inactive', 'graduated', 'paused'];

function optionalText(value, maxLength) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeStudentImportRow(row, index) {
  const errors = [];
  const fullName = String(row.full_name ?? '').trim();
  const dateOfBirth = optionalText(row.date_of_birth, 10);
  const gender = optionalText(row.gender, 20)?.toLowerCase() || null;
  const email = optionalText(row.email, 100)?.toLowerCase() || null;
  const status = optionalText(row.status, 20)?.toLowerCase() || 'active';

  if (fullName.length < 2 || fullName.length > 100) errors.push('họ và tên phải có 2-100 ký tự');
  if (dateOfBirth && !isIsoDate(dateOfBirth)) errors.push('ngày sinh phải theo định dạng YYYY-MM-DD');
  if (gender && !GENDERS.includes(gender)) errors.push('giới tính phải là male, female hoặc other');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email không hợp lệ');
  if (!STATUSES.includes(status)) errors.push('trạng thái không hợp lệ');

  return {
    rowNumber: index + 2,
    errors,
    value: {
      full_name: fullName,
      date_of_birth: dateOfBirth,
      gender,
      phone: optionalText(row.phone, 20),
      email,
      address: optionalText(row.address, 2000),
      school_name: optionalText(row.school_name, 150),
      grade_level: optionalText(row.grade_level, 30),
      status,
      note: optionalText(row.note, 2000),
    },
  };
}

function normalizeStudentImportRows(rows) {
  return rows.map(normalizeStudentImportRow);
}

module.exports = { normalizeStudentImportRow, normalizeStudentImportRows };
