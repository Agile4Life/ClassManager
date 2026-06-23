const { AppError } = require('./errors');

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;

function assertIdentifier(identifier, label = 'SQL identifier') {
  if (typeof identifier !== 'string' || !IDENTIFIER_PATTERN.test(identifier)) {
    throw new AppError(500, `${label} is invalid`);
  }
  return identifier;
}

function quoteIdentifier(identifier, label) {
  return `"${assertIdentifier(identifier, label)}"`;
}

function returningClause(returning) {
  if (returning === '*') return '*';
  return quoteIdentifier(returning, 'Returning column');
}

function pick(body, allowedColumns) {
  return Object.fromEntries(
    allowedColumns
      .filter((column) => Object.prototype.hasOwnProperty.call(body, column))
      .map((column) => [column, body[column]]),
  );
}

function buildInsert(table, values, returning = '*') {
  const columns = Object.keys(values);
  if (!columns.length) throw new AppError(400, 'No valid fields were provided');
  const params = columns.map((_, index) => `$${index + 1}`);
  const safeTable = quoteIdentifier(table, 'Table name');
  const safeColumns = columns.map((column) => quoteIdentifier(column, 'Column name'));
  return {
    text: `insert into ${safeTable} (${safeColumns.join(', ')}) values (${params.join(', ')}) returning ${returningClause(returning)}`,
    values: columns.map((column) => values[column]),
  };
}

function buildUpdate(table, primaryKey, id, values, returning = '*') {
  const columns = Object.keys(values);
  if (!columns.length) throw new AppError(400, 'No valid fields were provided');
  const safeTable = quoteIdentifier(table, 'Table name');
  const safePrimaryKey = quoteIdentifier(primaryKey, 'Primary key');
  const assignments = columns.map((column, index) => `${quoteIdentifier(column, 'Column name')} = $${index + 1}`);
  return {
    text: `update ${safeTable} set ${assignments.join(', ')} where ${safePrimaryKey} = $${columns.length + 1} returning ${returningClause(returning)}`,
    values: [...columns.map((column) => values[column]), id],
  };
}

module.exports = { pick, buildInsert, buildUpdate, assertIdentifier, quoteIdentifier };
