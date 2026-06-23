require('dotenv').config();
const pool = require('../src/config/db');

async function checkDatabase() {
  const database = await pool.query('select current_database() as database, now() as server_time');
  const tables = await pool.query(
    `select count(*)::int as count
     from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const views = await pool.query(
    `select count(*)::int as count
     from information_schema.views
     where table_schema = 'public'`,
  );
  const required = await pool.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_name = any($1::text[])`,
    [['user_accounts', 'students', 'classes', 'class_schedules', 'class_sessions']],
  );

  const requiredNames = new Set(required.rows.map((row) => row.table_name));
  const missing = ['user_accounts', 'students', 'classes', 'class_schedules', 'class_sessions']
    .filter((name) => !requiredNames.has(name));

  console.log(JSON.stringify({
    connected: true,
    database: database.rows[0].database,
    server_time: database.rows[0].server_time,
    public_table_count: tables.rows[0].count,
    public_view_count: views.rows[0].count,
    missing_required_tables: missing,
  }, null, 2));

  if (missing.length) process.exitCode = 2;
}

checkDatabase()
  .catch((error) => {
    console.error(`Database check failed: ${error.code || error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
