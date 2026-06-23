# AGENTS Backend Guide - Tuition Center Management System

This file is written for AI coding agents such as Cursor, Claude, Copilot, ChatGPT, or other repo-reading assistants.

Project goal: build a complete backend for a tuition center management web application using **Node.js + Express.js + Supabase PostgreSQL**.

The project does **not** need a beautiful UI yet. Focus on backend API, authentication, database usage, validation, timetable, and reporting.

---

## 1. Read These Files First

Before generating code, every agent must read these files in order:

```text
/database/schema.sql
/database/seed.sql
/database/README_DATABASE.md
```

Rules:

- Do not invent table names if the table already exists in `schema.sql`.
- Do not rename existing columns.
- Use the exact primary keys and foreign keys from the schema.
- Prefer SQL queries that match PostgreSQL / Supabase.
- Do not put database passwords, Supabase keys, or JWT secrets directly into code.
- Use `.env` for secrets.

---

## 2. Technology Stack

Use this backend stack:

```text
Node.js
Express.js
PostgreSQL on Supabase
pg
jsonwebtoken
dotenv
cors
bcrypt is optional, but current database seed uses PostgreSQL pgcrypto crypt()
```

Recommended packages:

```bash
npm install express pg dotenv cors jsonwebtoken
npm install nodemon --save-dev
```

Optional validation package:

```bash
npm install zod
```

---

## 3. Recommended Folder Structure

Create this backend structure:

```text
ClassManager/
│
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── README_DATABASE.md
│
├── src/
│   ├── config/
│   │   └── db.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── student.controller.js
│   │   ├── parent.controller.js
│   │   ├── teacher.controller.js
│   │   ├── subject.controller.js
│   │   ├── room.controller.js
│   │   ├── class.controller.js
│   │   ├── timetable.controller.js
│   │   ├── attendance.controller.js
│   │   ├── assignment.controller.js
│   │   ├── report.controller.js
│   │   ├── invoice.controller.js
│   │   └── payment.controller.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── student.routes.js
│   │   ├── parent.routes.js
│   │   ├── teacher.routes.js
│   │   ├── subject.routes.js
│   │   ├── room.routes.js
│   │   ├── class.routes.js
│   │   ├── timetable.routes.js
│   │   ├── attendance.routes.js
│   │   ├── assignment.routes.js
│   │   ├── report.routes.js
│   │   ├── invoice.routes.js
│   │   └── payment.routes.js
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   └── error.middleware.js
│   │
│   ├── utils/
│   │   ├── jwt.js
│   │   └── response.js
│   │
│   ├── app.js
│   └── server.js
│
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 4. Environment Variables

Create `.env.example`:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_SUPABASE_HOST:5432/postgres"
JWT_SECRET="change_this_secret"
JWT_EXPIRES_IN="1d"
REFRESH_TOKEN_EXPIRES_DAYS=7
```

Never commit the real `.env` file.

---

## 5. Database Connection

Use `pg` pool.

File: `src/config/db.js`

```js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = pool;
```

---

## 6. Standard API Response Format

All APIs should return the same structure.

Success:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Something went wrong"
}
```

---

## 7. Main Backend Modules

Build the backend in this order:

```text
1. Health check
2. Authentication
3. Students and parents
4. Teachers, subjects, rooms
5. Classes and enrollments
6. Timetable / weekly schedule
7. Sessions and attendance
8. Assignments and submissions
9. Reports and weak topic tracking
10. Invoices and payments
```

---

# 8. Authentication Module

## Tables

Use:

```text
user_accounts
user_sessions
login_logs
password_reset_tokens
```

## Required APIs

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

## Sample Login Accounts From seed.sql

```text
admin     / Admin@123
staff01   / Staff@123
teacher01 / Teacher@123
parent01  / Parent@123
student01 / Student@123
```

## Login Logic

When user logs in:

1. Receive `username` and `password`.
2. Query `user_accounts`.
3. Verify password with PostgreSQL `crypt()`:

```sql
select user_id, username, full_name, role, status
from user_accounts
where username = $1
  and password_hash = crypt($2, password_hash)
  and status = 'active';
```

4. If valid, create JWT.
5. Insert a row into `user_sessions`.
6. Insert success row into `login_logs`.
7. Return token and user profile.

## Logout Logic

When user logs out:

1. Require JWT.
2. Find active session if session ID is used.
3. Update `user_sessions`:

```sql
update user_sessions
set is_revoked = true,
    logout_at = now()
where session_id = $1
  and user_id = $2;
```

4. Return success.

---

# 9. Roles and Permissions

Roles from database:

```text
admin
staff
teacher
student
parent
```

Permission rules:

```text
admin:
- Full access to all APIs.

staff:
- Manage students, parents, teachers, subjects, rooms, classes, enrollments, invoices, payments.

teacher:
- View assigned classes.
- Manage sessions and attendance for assigned classes.
- Create assignments and questions.
- Grade submissions.
- Create progress reports.

student:
- View own classes.
- View own timetable.
- View own assignments, scores, reports, and attendance.

parent:
- View linked children's timetable, attendance, invoices, payments, and progress reports.
```

Create middleware:

```text
requireAuth
requireRole(...roles)
```

Example:

```js
router.post('/students', requireAuth, requireRole('admin', 'staff'), createStudent);
```

---

# 10. Timetable / Weekly Schedule Module

This module is required.

The system must support a clear timetable feature for classes, teachers, students, rooms, and parents.

## Important Existing Tables

Use these tables from `schema.sql`:

```text
classes
class_schedules
class_sessions
rooms
teachers
subjects
enrollments
students
parents
student_parents
```

## Meaning of Tables

```text
class_schedules
- Stores the repeated weekly timetable.
- Example: class C001 studies every Monday, Wednesday, Friday from 18:00 to 19:30.

class_sessions
- Stores real dated study sessions.
- Example: class C001 has an actual lesson on 2026-06-23 from 18:00 to 19:30.
```

Use both tables:

```text
class_schedules = template timetable
class_sessions  = actual lesson dates
```

## Timetable Requirements

The backend must support:

```text
1. View all weekly schedules.
2. View timetable by class.
3. View timetable by teacher.
4. View timetable by student.
5. View timetable by parent, showing their children's classes.
6. View timetable by room.
7. Add schedule to a class.
8. Update schedule.
9. Delete schedule.
10. Prevent teacher time conflicts.
11. Prevent room time conflicts.
12. Generate real class sessions from weekly schedules.
```

## Required Timetable APIs

```text
GET    /api/timetable
GET    /api/timetable/class/:classId
GET    /api/timetable/teacher/:teacherId
GET    /api/timetable/student/:studentId
GET    /api/timetable/parent/:parentId
GET    /api/timetable/room/:roomId

POST   /api/classes/:classId/schedules
PUT    /api/schedules/:scheduleId
DELETE /api/schedules/:scheduleId

POST   /api/classes/:classId/generate-sessions
```

## Query Parameters for Timetable

Support these query params where useful:

```text
day_of_week
teacher_id
student_id
class_id
room_id
subject_id
from_date
to_date
```

Example:

```text
GET /api/timetable?day_of_week=monday
GET /api/timetable/teacher/1
GET /api/timetable/student/1
GET /api/timetable/room/2
```

## Timetable Response Example

```json
{
  "success": true,
  "message": "Timetable fetched successfully",
  "data": [
    {
      "schedule_id": 1,
      "class_id": 1,
      "class_code": "C001",
      "class_name": "Grade 9 Mathematics - Evening Class",
      "subject_name": "Mathematics",
      "teacher_id": 1,
      "teacher_name": "Nguyen Van Minh",
      "room_id": 1,
      "room_name": "Room A101",
      "day_of_week": "monday",
      "start_time": "18:00:00",
      "end_time": "19:30:00"
    }
  ]
}
```

## SQL: Get Full Weekly Timetable

Use this query for `GET /api/timetable`:

```sql
select
    cs.schedule_id,
    c.class_id,
    c.class_code,
    c.class_name,
    sub.subject_id,
    sub.subject_name,
    t.teacher_id,
    t.full_name as teacher_name,
    r.room_id,
    r.room_name,
    cs.day_of_week,
    cs.start_time,
    cs.end_time
from class_schedules cs
join classes c on cs.class_id = c.class_id
join subjects sub on c.subject_id = sub.subject_id
left join teachers t on c.teacher_id = t.teacher_id
left join rooms r on cs.room_id = r.room_id
order by
    case cs.day_of_week
        when 'monday' then 1
        when 'tuesday' then 2
        when 'wednesday' then 3
        when 'thursday' then 4
        when 'friday' then 5
        when 'saturday' then 6
        when 'sunday' then 7
    end,
    cs.start_time;
```

## SQL: Get Timetable By Class

```sql
select
    cs.schedule_id,
    c.class_id,
    c.class_code,
    c.class_name,
    sub.subject_name,
    t.full_name as teacher_name,
    r.room_name,
    cs.day_of_week,
    cs.start_time,
    cs.end_time
from class_schedules cs
join classes c on cs.class_id = c.class_id
join subjects sub on c.subject_id = sub.subject_id
left join teachers t on c.teacher_id = t.teacher_id
left join rooms r on cs.room_id = r.room_id
where c.class_id = $1
order by cs.day_of_week, cs.start_time;
```

## SQL: Get Timetable By Teacher

```sql
select
    cs.schedule_id,
    c.class_id,
    c.class_code,
    c.class_name,
    sub.subject_name,
    t.teacher_id,
    t.full_name as teacher_name,
    r.room_name,
    cs.day_of_week,
    cs.start_time,
    cs.end_time
from class_schedules cs
join classes c on cs.class_id = c.class_id
join subjects sub on c.subject_id = sub.subject_id
join teachers t on c.teacher_id = t.teacher_id
left join rooms r on cs.room_id = r.room_id
where t.teacher_id = $1
order by cs.day_of_week, cs.start_time;
```

## SQL: Get Timetable By Student

```sql
select
    cs.schedule_id,
    s.student_id,
    s.full_name as student_name,
    c.class_id,
    c.class_code,
    c.class_name,
    sub.subject_name,
    t.full_name as teacher_name,
    r.room_name,
    cs.day_of_week,
    cs.start_time,
    cs.end_time
from enrollments e
join students s on e.student_id = s.student_id
join classes c on e.class_id = c.class_id
join class_schedules cs on c.class_id = cs.class_id
join subjects sub on c.subject_id = sub.subject_id
left join teachers t on c.teacher_id = t.teacher_id
left join rooms r on cs.room_id = r.room_id
where s.student_id = $1
  and e.status = 'studying'
order by cs.day_of_week, cs.start_time;
```

## SQL: Get Timetable By Parent

```sql
select
    p.parent_id,
    p.full_name as parent_name,
    s.student_id,
    s.full_name as student_name,
    c.class_id,
    c.class_code,
    c.class_name,
    sub.subject_name,
    t.full_name as teacher_name,
    r.room_name,
    cs.day_of_week,
    cs.start_time,
    cs.end_time
from parents p
join student_parents sp on p.parent_id = sp.parent_id
join students s on sp.student_id = s.student_id
join enrollments e on s.student_id = e.student_id
join classes c on e.class_id = c.class_id
join class_schedules cs on c.class_id = cs.class_id
join subjects sub on c.subject_id = sub.subject_id
left join teachers t on c.teacher_id = t.teacher_id
left join rooms r on cs.room_id = r.room_id
where p.parent_id = $1
  and e.status = 'studying'
order by s.full_name, cs.day_of_week, cs.start_time;
```

## SQL: Check Room Schedule Conflict

Before inserting or updating a class schedule, check if the room is already used at the same time.

Time conflict rule:

```text
new_start < existing_end AND new_end > existing_start
```

SQL:

```sql
select cs.schedule_id
from class_schedules cs
where cs.room_id = $1
  and cs.day_of_week = $2
  and $3::time < cs.end_time
  and $4::time > cs.start_time
  and ($5::bigint is null or cs.schedule_id <> $5)
limit 1;
```

Parameters:

```text
$1 = room_id
$2 = day_of_week
$3 = new start_time
$4 = new end_time
$5 = current schedule_id when updating, null when inserting
```

If this query returns a row, reject the request:

```json
{
  "success": false,
  "message": "Room is already booked during this time"
}
```

## SQL: Check Teacher Schedule Conflict

Because teacher is stored in `classes`, check teacher conflict by joining `classes`.

```sql
select cs.schedule_id
from class_schedules cs
join classes c on cs.class_id = c.class_id
where c.teacher_id = $1
  and cs.day_of_week = $2
  and $3::time < cs.end_time
  and $4::time > cs.start_time
  and ($5::bigint is null or cs.schedule_id <> $5)
limit 1;
```

Parameters:

```text
$1 = teacher_id
$2 = day_of_week
$3 = new start_time
$4 = new end_time
$5 = current schedule_id when updating, null when inserting
```

If this query returns a row, reject the request:

```json
{
  "success": false,
  "message": "Teacher already has another class during this time"
}
```

## Create Schedule Logic

For `POST /api/classes/:classId/schedules`:

Request body:

```json
{
  "room_id": 1,
  "day_of_week": "monday",
  "start_time": "18:00",
  "end_time": "19:30"
}
```

Steps:

```text
1. Check class exists.
2. Check day_of_week is valid.
3. Check end_time > start_time.
4. Get teacher_id from classes.
5. Check room conflict.
6. Check teacher conflict.
7. Insert into class_schedules.
8. Return created schedule.
```

## Generate Real Class Sessions

Use `class_schedules` to generate rows in `class_sessions`.

API:

```text
POST /api/classes/:classId/generate-sessions
```

Request body:

```json
{
  "from_date": "2026-06-01",
  "to_date": "2026-06-30"
}
```

Logic:

```text
1. Get all class_schedules for this class.
2. Loop from from_date to to_date.
3. For each date, find its day_of_week.
4. If date matches a class schedule, insert class_sessions.
5. Avoid duplicate sessions for the same class_id + session_date + start_time.
```

Important: The current schema does not have a unique constraint for class session duplicates. Avoid duplicates in application logic first.

Optional future improvement:

```sql
alter table class_sessions
add constraint uq_class_session_datetime unique (class_id, session_date, start_time);
```

Only add this if the team agrees to update the schema.

---

# 11. Students and Parents Module

## Tables

```text
students
parents
student_parents
```

## Required APIs

```text
GET    /api/students
GET    /api/students/:id
POST   /api/students
PUT    /api/students/:id
DELETE /api/students/:id

GET    /api/parents
GET    /api/parents/:id
POST   /api/parents
PUT    /api/parents/:id
DELETE /api/parents/:id

POST   /api/students/:studentId/parents/:parentId
GET    /api/students/:studentId/parents
```

---

# 12. Teachers, Subjects, Rooms Module

## Tables

```text
teachers
subjects
rooms
```

## Required APIs

```text
GET    /api/teachers
GET    /api/teachers/:id
POST   /api/teachers
PUT    /api/teachers/:id
DELETE /api/teachers/:id

GET    /api/subjects
GET    /api/subjects/:id
POST   /api/subjects
PUT    /api/subjects/:id
DELETE /api/subjects/:id

GET    /api/rooms
GET    /api/rooms/:id
POST   /api/rooms
PUT    /api/rooms/:id
DELETE /api/rooms/:id
```

---

# 13. Classes and Enrollments Module

## Tables

```text
classes
class_schedules
enrollments
```

## Required APIs

```text
GET    /api/classes
GET    /api/classes/:id
POST   /api/classes
PUT    /api/classes/:id
DELETE /api/classes/:id

GET    /api/classes/:classId/students
POST   /api/classes/:classId/enroll/:studentId
PUT    /api/enrollments/:id
DELETE /api/enrollments/:id
```

When enrolling a student:

```text
1. Check class exists.
2. Check student exists.
3. Check student is not already enrolled in the same class.
4. Check class has not exceeded max_students.
5. Insert into enrollments.
```

---

# 14. Sessions and Attendance Module

## Tables

```text
class_sessions
attendance
```

## Required APIs

```text
GET    /api/classes/:classId/sessions
POST   /api/classes/:classId/sessions
PUT    /api/sessions/:sessionId
DELETE /api/sessions/:sessionId

GET    /api/sessions/:sessionId/attendance
POST   /api/sessions/:sessionId/attendance
PUT    /api/attendance/:attendanceId
```

Attendance status values:

```text
present
absent
late
excused
```

---

# 15. Assignments and Performance Module

## Tables

```text
learning_topics
assignments
assignment_questions
assignment_submissions
student_answers
```

## Required APIs

```text
GET    /api/topics
POST   /api/topics
PUT    /api/topics/:topicId
DELETE /api/topics/:topicId

GET    /api/classes/:classId/assignments
POST   /api/classes/:classId/assignments
GET    /api/assignments/:assignmentId
PUT    /api/assignments/:assignmentId
DELETE /api/assignments/:assignmentId

GET    /api/assignments/:assignmentId/questions
POST   /api/assignments/:assignmentId/questions
PUT    /api/questions/:questionId
DELETE /api/questions/:questionId

GET    /api/assignments/:assignmentId/submissions
POST   /api/assignments/:assignmentId/submissions
GET    /api/students/:studentId/submissions

POST   /api/submissions/:submissionId/answers
PUT    /api/answers/:answerId
```

Important rule:

```text
Each assignment question should have a topic_id.
The topic_id allows the report system to detect which skill or topic a student is weak at.
```

---

# 16. Reports Module

## Tables and Views

```text
progress_reports
v_student_topic_performance
v_student_weak_topics
v_student_assignment_summary
```

## Required APIs

```text
GET    /api/reports/student/:studentId
POST   /api/reports
PUT    /api/reports/:reportId
DELETE /api/reports/:reportId

GET    /api/reports/weak-topics
GET    /api/reports/student/:studentId/weak-topics
GET    /api/reports/student/:studentId/assignment-summary
GET    /api/reports/class/:classId/performance
```

Use `v_student_weak_topics` to show topics where `mastery_percent < 60`.

---

# 17. Finance Module

## Tables

```text
invoices
payments
```

## Required APIs

```text
GET    /api/invoices
GET    /api/invoices/:invoiceId
POST   /api/invoices
PUT    /api/invoices/:invoiceId
DELETE /api/invoices/:invoiceId

GET    /api/students/:studentId/invoices
GET    /api/payments
POST   /api/payments
GET    /api/students/:studentId/payments
```

Invoice status:

```text
unpaid
paid
partial
cancelled
```

Payment methods:

```text
cash
bank_transfer
momo
zalopay
other
```

---

# 18. API Implementation Priority

Build the APIs in this exact order:

```text
1. GET /api/health
2. POST /api/auth/login
3. POST /api/auth/logout
4. GET /api/auth/me
5. GET /api/students
6. POST /api/students
7. PUT /api/students/:id
8. DELETE /api/students/:id
9. GET /api/teachers
10. GET /api/subjects
11. GET /api/rooms
12. GET /api/classes
13. POST /api/classes
14. POST /api/classes/:classId/enroll/:studentId
15. GET /api/classes/:classId/students
16. GET /api/timetable
17. GET /api/timetable/class/:classId
18. GET /api/timetable/teacher/:teacherId
19. GET /api/timetable/student/:studentId
20. POST /api/classes/:classId/schedules
21. POST /api/classes/:classId/generate-sessions
22. POST /api/classes/:classId/sessions
23. POST /api/sessions/:sessionId/attendance
24. POST /api/classes/:classId/assignments
25. POST /api/assignments/:assignmentId/questions
26. POST /api/assignments/:assignmentId/submissions
27. GET /api/reports/student/:studentId/weak-topics
28. POST /api/invoices
29. POST /api/payments
```

---

# 19. Testing Checklist

The backend is acceptable when these work:

```text
[ ] Server starts successfully.
[ ] Database connection works.
[ ] GET /api/health returns success.
[ ] Login works with admin account.
[ ] Logout updates user_sessions.
[ ] JWT middleware blocks unauthenticated requests.
[ ] Role middleware blocks unauthorized roles.
[ ] CRUD students works.
[ ] CRUD teachers works.
[ ] CRUD subjects works.
[ ] CRUD rooms works.
[ ] CRUD classes works.
[ ] Student enrollment works.
[ ] Weekly timetable can be viewed.
[ ] Timetable by teacher works.
[ ] Timetable by student works.
[ ] Timetable by parent works.
[ ] Timetable prevents room conflicts.
[ ] Timetable prevents teacher conflicts.
[ ] Class sessions can be generated from schedules.
[ ] Attendance works.
[ ] Assignments and questions work.
[ ] Submissions and grading work.
[ ] Weak topic report works.
[ ] Invoices and payments work.
```

---

# 20. Important Coding Rules for Agents

Follow these rules strictly:

```text
1. Keep controllers focused on request and response.
2. Put reusable SQL logic into helper functions only if necessary.
3. Always use parameterized SQL queries with $1, $2, $3.
4. Never concatenate user input into SQL strings.
5. Validate required fields before inserting.
6. Return consistent JSON responses.
7. Use proper HTTP status codes.
8. Protect private routes with requireAuth.
9. Protect role-specific routes with requireRole.
10. Do not expose password_hash in API responses.
11. Do not expose refresh_token_hash in API responses.
12. Do not commit .env.
13. Use database/schema.sql as the source of truth.
14. Do not modify schema unless the user explicitly asks.
15. For timetable conflicts, always check room and teacher availability before insert/update.
```

---

# 21. Suggested Prompt for Coding Agents

Use this prompt when asking an AI coding agent to implement backend code:

```text
Read database/schema.sql, database/seed.sql, database/README_DATABASE.md, and AGENTS_BACKEND_GUIDE.md first.

Build the backend using Node.js, Express.js, pg, dotenv, cors, and jsonwebtoken.

Start with:
1. Database connection
2. GET /api/health
3. Authentication login/logout/me
4. Students CRUD
5. Timetable module

Do not invent new database tables.
Use parameterized SQL queries only.
Use the existing schema and seed data.
Implement role-based middleware.
Do not expose password_hash or refresh_token_hash in responses.
```

---

# 22. Timetable Development Summary

The timetable feature is one of the most important parts of this project.

Minimum timetable functions:

```text
- Admin/staff can create weekly schedules for classes.
- Admin/staff can assign room and time.
- System prevents room conflicts.
- System prevents teacher conflicts.
- Teacher can view their weekly timetable.
- Student can view their own weekly timetable.
- Parent can view their children's timetable.
- Admin/staff can generate real class sessions from weekly schedule.
```

Do not skip this module.

