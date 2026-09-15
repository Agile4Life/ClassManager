const { AppError } = require('./errors');

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertOptionalIsoDate(value, fieldName) {
  if (value !== undefined && !isIsoDate(value)) {
    throw new AppError(400, `${fieldName} must use YYYY-MM-DD format`);
  }
}

function getPagination(query, defaultLimit = 50) {
  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? defaultLimit);
  if (!Number.isInteger(rawPage) || rawPage < 1) throw new AppError(400, 'page must be a positive integer');
  if (!Number.isInteger(rawLimit) || rawLimit < 1) throw new AppError(400, 'limit must be a positive integer');
  const limit = Math.min(rawLimit, 100);
  return { page: rawPage, limit, offset: (rawPage - 1) * limit };
}

module.exports = { timeToMinutes, isIsoDate, assertOptionalIsoDate, getPagination };
