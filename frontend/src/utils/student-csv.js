export const STUDENT_CSV_HEADERS = [
  'full_name', 'date_of_birth', 'gender', 'phone', 'email',
  'address', 'school_name', 'grade_level', 'status', 'note',
];

const HEADER_ALIASES = {
  full_name: 'full_name', ho_va_ten: 'full_name', ten_hoc_sinh: 'full_name',
  date_of_birth: 'date_of_birth', ngay_sinh: 'date_of_birth',
  gender: 'gender', gioi_tinh: 'gender',
  phone: 'phone', so_dien_thoai: 'phone', dien_thoai: 'phone',
  email: 'email',
  address: 'address', dia_chi: 'address',
  school_name: 'school_name', truong_hoc: 'school_name', truong: 'school_name',
  grade_level: 'grade_level', khoi_lop: 'grade_level', khoi: 'grade_level',
  status: 'status', trang_thai: 'status',
  note: 'note', ghi_chu: 'note',
};

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (let index = 0; index < firstLine.length; index += 1) {
    if (firstLine[index] === '"') quoted = !quoted;
    else if (!quoted && firstLine[index] === ',') commas += 1;
    else if (!quoted && firstLine[index] === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function parseMatrix(text) {
  const content = String(text || '').replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(content);
  const matrix = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && content[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) matrix.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('File CSV có dấu ngoặc kép chưa được đóng.');
  row.push(field);
  if (row.some((value) => value.trim())) matrix.push(row);
  return matrix;
}

function normalizeDate(value) {
  const text = value.trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : text;
}

function normalizeGender(value) {
  const key = normalizeKey(value);
  return { nam: 'male', male: 'male', nu: 'female', female: 'female', khac: 'other', other: 'other' }[key] || key;
}

function normalizeStatus(value) {
  const key = normalizeKey(value);
  return {
    active: 'active', dang_hoat_dong: 'active',
    inactive: 'inactive', ngung_hoat_dong: 'inactive',
    paused: 'paused', tam_nghi: 'paused',
    graduated: 'graduated', da_tot_nghiep: 'graduated',
  }[key] || key;
}

function validateRow(row, rowNumber) {
  const errors = [];
  if (row.full_name.length < 2 || row.full_name.length > 100) errors.push('Họ và tên phải có 2-100 ký tự');
  if (row.date_of_birth) {
    const date = new Date(`${row.date_of_birth}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date_of_birth)
        || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== row.date_of_birth) {
      errors.push('Ngày sinh phải là ngày hợp lệ theo YYYY-MM-DD');
    }
  }
  if (row.gender && !['male', 'female', 'other'].includes(row.gender)) errors.push('Giới tính không hợp lệ');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Email không hợp lệ');
  if (row.status && !['active', 'inactive', 'paused', 'graduated'].includes(row.status)) errors.push('Trạng thái không hợp lệ');
  return errors.map((message) => `Dòng ${rowNumber}: ${message}`);
}

export function parseStudentCsv(text) {
  const matrix = parseMatrix(text);
  if (matrix.length < 2) throw new Error('File CSV phải có hàng tiêu đề và ít nhất một học sinh.');
  const headers = matrix[0].map((header) => HEADER_ALIASES[normalizeKey(header)] || normalizeKey(header));
  if (!headers.includes('full_name')) throw new Error('File CSV thiếu cột full_name hoặc Họ và tên.');
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length) throw new Error(`File CSV có cột bị lặp: ${[...new Set(duplicates)].join(', ')}.`);

  const rows = matrix.slice(1).map((values) => {
    const row = Object.fromEntries(STUDENT_CSV_HEADERS.map((header) => [header, '']));
    headers.forEach((header, index) => {
      if (STUDENT_CSV_HEADERS.includes(header)) row[header] = String(values[index] || '').trim();
    });
    row.date_of_birth = normalizeDate(row.date_of_birth);
    row.gender = normalizeGender(row.gender);
    row.status = row.status ? normalizeStatus(row.status) : 'active';
    return row;
  });
  const errors = rows.flatMap((row, index) => validateRow(row, index + 2));
  return { rows, errors };
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadStudentCsvTemplate() {
  const sample = [
    'Nguyễn Văn An', '2010-05-12', 'male', '0901234567', 'an@example.com',
    'Quận 1, TP.HCM', 'THCS Nguyễn Du', 'Khối 9', 'active', '',
  ];
  const csv = `\uFEFF${STUDENT_CSV_HEADERS.join(',')}\r\n${sample.map(escapeCsv).join(',')}\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mau-danh-sach-hoc-sinh.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
