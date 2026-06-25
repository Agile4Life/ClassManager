const pool = require('./src/config/db');
async function check() {
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'students';
  `);
  console.log(result.rows);
  pool.end();
}
check();
