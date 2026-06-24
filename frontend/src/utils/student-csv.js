export const STUDENT_CSV_HEADERS = ['full_name', 'father_phone', 'mother_phone', 'student_phone'];

const HEADER_ALIASES = {
  full_name: 'full_name', ho_va_ten: 'full_name', ten_hoc_sinh: 'full_name',
  father_phone: 'father_phone', dt_ba: 'father_phone', sdt_ba: 'father_phone',
  dien_thoai_ba: 'father_phone', so_dien_thoai_ba: 'father_phone',
  mother_phone: 'mother_phone', dt_me: 'mother_phone', sdt_me: 'mother_phone',
  dien_thoai_me: 'mother_phone', so_dien_thoai_me: 'mother_phone',
  student_phone: 'student_phone', phone: 'student_phone', dt_hoc_sinh: 'student_phone',
  sdt_hoc_sinh: 'student_phone', dien_thoai_hoc_sinh: 'student_phone', so_dien_thoai_hoc_sinh: 'student_phone',
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

function isValidPhone(phone) {
  return !phone || (/^[+0-9][0-9 .()-]{7,19}$/.test(phone) && phone.length <= 20);
}

function validateRow(row, rowNumber) {
  const errors = [];
  if (row.full_name.length < 2 || row.full_name.length > 100) errors.push('Họ và tên phải có 2-100 ký tự');
  if (!isValidPhone(row.father_phone)) errors.push('Điện thoại ba không hợp lệ');
  if (!isValidPhone(row.mother_phone)) errors.push('Điện thoại mẹ không hợp lệ');
  if (!isValidPhone(row.student_phone)) errors.push('Điện thoại học sinh không hợp lệ');
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
  const sample = ['Nguyễn Văn An', '0901111111', '0902222222', '0903333333'];
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
