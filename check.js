const pool = require('./src/config/db');
async function check() {
  const accounts = await pool.query("select user_id, username, role, teacher_id from user_accounts where role = 'teacher'");
  console.log('Teacher Accounts:', accounts.rows);

  const classes = await pool.query("select class_id, class_name, teacher_id from classes");
  console.log('Classes:', classes.rows);

  const classTeachers = await pool.query("select * from class_teachers");
  console.log('Class Teachers:', classTeachers.rows);

  const schedules = await pool.query("select schedule_id, class_id from class_schedules");
  console.log('Schedules:', schedules.rows);

  const scheduleTeachers = await pool.query("select * from class_schedule_teachers");
  console.log('Schedule Teachers:', scheduleTeachers.rows);

  pool.end();
}
check();
