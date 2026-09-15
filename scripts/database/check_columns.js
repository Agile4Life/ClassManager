const pool = require('../../backend/config/db');

async function check() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'students';
    `);
    console.log(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

if (require.main === module) {
  check();
}

module.exports = check;
