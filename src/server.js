require('dotenv').config();
const app = require('./app');
const pool = require('./config/db');

const port = Number(process.env.PORT) || 3000;
let server;

async function start() {
  await pool.query('select 1');
  try {
    await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
  } catch (error) {
    console.error('Failed to run migration:', error.message);
  }
  await new Promise((resolve, reject) => {
    server = app.listen(port);
    server.once('listening', resolve);
    server.once('error', reject);
  });
  console.log(`ClassManager API is running on port ${port}`);
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch(async (error) => {
  console.error('Failed to start ClassManager API', error);
  await pool.end();
  process.exit(1);
});
