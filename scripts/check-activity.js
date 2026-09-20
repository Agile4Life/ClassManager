require('dotenv').config();
const pool = require('../backend/config/db');

async function check() {
  const res = await pool.query(`
    select pid, usename, state, wait_event_type, wait_event, query, now() - query_start as duration
    from pg_stat_activity
    where state != 'idle' and pid != pg_backend_pid()
  `);
  console.log('Active queries:', res.rows);
  await pool.end();
}

check().catch(console.error);
