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
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

module.exports = pool;
