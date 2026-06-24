const { AppError } = require('./errors');
const { quoteIdentifier } = require('./query');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function generateNextCode(client, config) {
  const { table, column, prefix, digits = 3 } = config;
  if (typeof prefix !== 'string' || !prefix || !Number.isInteger(digits) || digits < 1) {
    throw new AppError(500, 'Auto-code configuration is invalid');
  }

  const safeTable = quoteIdentifier(table, 'Auto-code table');
  const safeColumn = quoteIdentifier(column, 'Auto-code column');
  const pattern = `^${escapeRegex(prefix)}([0-9]+)$`;

  // Prevent simultaneous create requests from receiving the same code.
  await client.query('select pg_advisory_xact_lock(hashtext($1))', [`auto-code:${table}:${column}`]);
  const result = await client.query(
    `select coalesce(max((substring(${safeColumn} from $1))::bigint), 0) + 1 as next_number
     from ${safeTable}
     where ${safeColumn} ~ $1`,
    [pattern],
  );

  return `${prefix}${String(result.rows[0].next_number).padStart(digits, '0')}`;
}

module.exports = { generateNextCode };
