const pool = require('../../backend/config/db');

async function run() {
  try {
    await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;');
    console.log('Column is_deleted added.');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

if (require.main === module) {
  run();
}

module.exports = run;
