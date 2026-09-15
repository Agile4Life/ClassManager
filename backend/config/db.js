const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const useSsl = process.env.DATABASE_SSL !== 'false';
let connectionString = process.env.DATABASE_URL;

// pg-connection-string lets sslmode in the URL replace the explicit ssl object.
// Supabase pooler certificates need rejectUnauthorized=false in this setup.
if (useSsl) {
  const parsedUrl = new URL(connectionString);
  parsedUrl.searchParams.delete('sslmode');
  connectionString = parsedUrl.toString();
}

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: Math.max(Number(process.env.DATABASE_POOL_MAX) || 10, 1),
  idleTimeoutMillis: Math.max(Number(process.env.DATABASE_IDLE_TIMEOUT_MS) || 30_000, 1_000),
  connectionTimeoutMillis: Math.max(Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS) || 5_000, 1_000),
  statement_timeout: Math.max(Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS) || 15_000, 1_000),
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

module.exports = pool;
