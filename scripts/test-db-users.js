require('dotenv').config();
const pool = require('../backend/config/db');

async function main() {
  const accounts = [
    { username: 'admin', pass: 'Admin@123' },
    { username: 'staff01', pass: 'Staff@123' },
    { username: 'teacher01', pass: 'Teacher@123' },
    { username: 'parent01', pass: 'Parent@123' },
    { username: 'student01', pass: 'Student@123' },
  ];

  await pool.query("update user_accounts set status = 'active' where username = 'teacher01'");
  console.log('teacher01 activated');
  for (const acc of accounts) {
    const res = await pool.query(
      `select username, role, status, (password_hash = crypt($1, password_hash)) as password_match
       from user_accounts where username = $2`,
      [acc.pass, acc.username]
    );
    console.log(res.rows[0]);
  }
  await pool.end();
}

main().catch(console.error);
