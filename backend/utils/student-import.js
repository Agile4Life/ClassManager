function optionalPhone(value) {
  const phone = String(value ?? '').trim();
  return phone || null;
}

function normalizeStudentImportRow(row, index) {
  const errors = [];
  const fullName = String(row.full_name ?? '').trim();
  const fatherPhone = optionalPhone(row.father_phone);
  const motherPhone = optionalPhone(row.mother_phone);
  const studentPhone = optionalPhone(row.student_phone ?? row.phone);

  if (fullName.length < 2 || fullName.length > 100) errors.push('họ và tên phải có 2-100 ký tự');
  for (const [label, phone] of [['điện thoại ba', fatherPhone], ['điện thoại mẹ', motherPhone], ['điện thoại học sinh', studentPhone]]) {
    if (phone && (!/^[+0-9][0-9 .()-]{7,19}$/.test(phone) || phone.length > 20)) {
      errors.push(`${label} không hợp lệ`);
    }
  }

  return {
    rowNumber: index + 2,
    errors,
    value: {
      full_name: fullName,
      father_phone: fatherPhone,
      mother_phone: motherPhone,
      student_phone: studentPhone,
    },
  };
}

function normalizeStudentImportRows(rows) {
  return rows.map(normalizeStudentImportRow);
}

module.exports = { normalizeStudentImportRow, normalizeStudentImportRows };
