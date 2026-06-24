# Database Design - Tuition Center Management System

## 1. Overview

This database is designed for a tuition center management system. It supports student management, parent information, teacher management, classes, subjects, schedules, attendance, assignments, learning reports, tuition invoices, payments, and user authentication.

The database is written for **PostgreSQL** and can be used directly in **Supabase**.

Recommended project stack:

```text
Frontend / Backend: Next.js or Node.js
Database: Supabase PostgreSQL
Deployment: Vercel + Supabase
```

Recommended database folder structure:

```text
database/
├── schema.sql
├── seed.sql
└── README_DATABASE.md
```

---

## 2. Files

### `schema.sql`

This file creates the database structure, including:

- Tables
- Primary keys
- Foreign keys
- Constraints
- Indexes
- Views
- Authentication-related tables

Run this file first.

### `seed.sql`

This file inserts sample data for testing, including:

- Subjects
- Teachers
- Rooms
- Students
- Parents
- Classes
- Schedules
- Enrollments
- Attendance
- User login accounts
- Invoices
- Payments
- Assignments
- Student answers
- Progress reports

Run this file after `schema.sql`.

### `migrations/20260624_learning_history.sql`

Run this file once when upgrading an existing database to add learning-history tracking. It only adds columns, a table, and indexes; it does not delete current data. A new database created from the latest `schema.sql` does not need this migration.

---

## 3. How to Run in Supabase

Open your Supabase project, then go to:

```text
SQL Editor → New query
```

Run the files in this order:

```text
1. schema.sql
2. seed.sql
```

If Supabase shows a warning about destructive operations, it is because `schema.sql` contains `DROP TABLE IF EXISTS` and `DROP VIEW IF EXISTS` statements. These statements remove old database objects before creating new ones.

Only run `schema.sql` on a new or test database, because it can delete existing data.

---

## 4. Main Modules

## 4.1 Authentication Module

This module is used for login, logout, session management, login tracking, and password reset.

### `user_accounts`

Stores all login accounts.

Supported roles:

```text
admin
staff
teacher
student
parent
```

Important columns:

```text
user_id
username
password_hash
full_name
email
phone
role
status
teacher_id
student_id
parent_id
last_login_at
created_at
updated_at
```

Role linking rule:

- `admin` and `staff` accounts are not linked to teachers, students, or parents.
- `teacher` accounts must link to a teacher record.
- `student` accounts must link to a student record.
- `parent` accounts must link to a parent record.

### `user_sessions`

Stores active and revoked login sessions.

Important columns:

```text
session_id
user_id
refresh_token_hash
ip_address
user_agent
is_revoked
login_at
logout_at
expires_at
```

Logout logic:

```sql
update user_sessions
set is_revoked = true,
    logout_at = now()
where session_id = 'PUT_SESSION_ID_HERE';
```

### `login_logs`

Stores login attempt history.

Important columns:

```text
login_log_id
user_id
username_input
success
failure_reason
ip_address
user_agent
created_at
```

### `password_reset_tokens`

Stores password reset tokens.

Important columns:

```text
reset_token_id
user_id
token_hash
expires_at
used_at
created_at
```

---

## 4.2 Student and Parent Module

### `students`

Stores student information.

Important columns:

```text
student_id
student_code
full_name
date_of_birth
gender
phone
email
address
school_name
grade_level
status
note
created_at
```

Supported student statuses:

```text
active
inactive
graduated
paused
```

### `parents`

Stores parent or guardian information.

Important columns:

```text
parent_id
full_name
phone
email
address
occupation
created_at
```

### `student_parents`

Connects students and parents.

This table supports:

- One student having multiple parents or guardians.
- One parent having multiple children.

Important columns:

```text
student_id
parent_id
relationship
is_primary_contact
```

Supported relationships:

```text
father
mother
guardian
other
```

---

## 4.3 Teacher Module

### `teachers`

Stores teacher information.

Important columns:

```text
teacher_id
teacher_code
full_name
phone
email
address
specialization
hourly_rate
status
note
created_at
```

Supported teacher statuses:

```text
active
inactive
paused
```

---

## 4.4 Subject, Room, and Class Module

### `subjects`

Stores subjects taught at the center.

Example subjects:

```text
Mathematics
English
Physics
Chemistry
Literature
```

Important columns:

```text
subject_id
subject_code
subject_name
description
status
created_at
```

### `rooms`

Stores room information.

Important columns:

```text
room_id
room_name
capacity
location
status
created_at
```

Supported room statuses:

```text
available
maintenance
inactive
```

### `classes`

Stores class information.

A class belongs to one subject and may have one teacher and one room.

Important columns:

```text
class_id
class_code
class_name
subject_id
teacher_id
room_id
grade_level
max_students
tuition_fee
start_date
end_date
status
note
created_at
```

Supported class statuses:

```text
active
completed
cancelled
paused
```

---

## 4.5 Schedule and Attendance Module

### `class_schedules`

Stores weekly schedules for classes.

Example:

```text
Class C001 studies every Monday, Wednesday, and Friday from 18:00 to 19:30.
```

Important columns:

```text
schedule_id
class_id
room_id
day_of_week
start_time
end_time
created_at
```

Supported days:

```text
monday
tuesday
wednesday
thursday
friday
saturday
sunday
```

### `class_sessions`

Stores actual study sessions.

A class schedule is the repeated weekly plan, while a class session is a real lesson on a specific date.

Important columns:

```text
session_id
class_id
session_date
start_time
end_time
topic
status
note
created_at
```

Supported session statuses:

```text
scheduled
completed
cancelled
```

### `attendance`

Stores student attendance for each class session.

Important columns:

```text
attendance_id
session_id
student_id
status
check_in_time
note
created_at
```

Supported attendance statuses:

```text
present
absent
late
excused
```

---

## 4.6 Enrollment Module

### `enrollments`

Stores which student joins which class.

Important columns:

```text
enrollment_id
student_id
class_id
enrolled_date
status
discount_percent
note
created_at
```

Supported enrollment statuses:

```text
studying
completed
dropped
paused
```

A student cannot be enrolled in the same class twice because the database has this unique rule:

```text
unique(student_id, class_id)
```

---

## 4.7 Assignment and Performance Tracking Module

This module is used to report homework and detect which topics students are weak at.

### `learning_topics`

Stores learning topics or skill areas in each subject.

Examples:

```text
Linear Equations
Quadratic Equations
Geometry Basics
English Tenses
Reading Comprehension
Motion and Forces
```

Important columns:

```text
topic_id
subject_id
topic_name
description
difficulty_level
status
created_at
```

Supported difficulty levels:

```text
easy
medium
hard
```

### `assignments`

Stores homework or assignments given to a class.

Important columns:

```text
assignment_id
class_id
teacher_id
title
description
assigned_date
due_date
total_score
status
created_at
```

Supported assignment statuses:

```text
draft
assigned
closed
cancelled
```

### `assignment_questions`

Stores questions inside each assignment.

Each question can be linked to a learning topic. This is the key design that allows the system to know which topic a student is weak at.

Important columns:

```text
question_id
assignment_id
topic_id
question_no
question_text
question_type
difficulty_level
max_score
correct_answer
created_at
```

Supported question types:

```text
multiple_choice
short_answer
essay
calculation
true_false
other
```

### `assignment_submissions`

Stores each student's submission for an assignment.

Important columns:

```text
submission_id
assignment_id
student_id
submitted_at
status
total_score
teacher_feedback
graded_at
created_at
```

Supported submission statuses:

```text
not_submitted
submitted
graded
late
missing
```

### `student_answers`

Stores each answer and score for each question.

This table is used to calculate topic performance.

Important columns:

```text
answer_id
submission_id
question_id
student_answer
score
is_correct
teacher_comment
created_at
```

---

## 4.8 Progress Report Module

### `progress_reports`

Stores study reports written by teachers for students and parents.

Important columns:

```text
report_id
student_id
class_id
teacher_id
parent_id
report_title
period_start
period_end
homework_summary
attendance_summary
strength_summary
weakness_summary
teacher_recommendation
parent_note
status
sent_at
created_at
```

Supported report statuses:

```text
draft
sent
archived
```

Use this table to generate reports such as:

```text
- Monthly study report
- Weekly homework report
- Weak topic report
- Teacher recommendation report
```

---

## 4.9 Finance Module

### `invoices`

Stores tuition invoices.

Important columns:

```text
invoice_id
student_id
class_id
invoice_month
invoice_year
total_amount
discount_amount
final_amount
due_date
status
note
created_at
```

Supported invoice statuses:

```text
unpaid
paid
partial
cancelled
```

### `payments`

Stores payment records.

Important columns:

```text
payment_id
invoice_id
student_id
class_id
amount
payment_date
payment_method
status
transaction_code
note
created_at
```

Supported payment methods:

```text
cash
bank_transfer
momo
zalopay
other
```

Supported payment statuses:

```text
paid
refunded
cancelled
```

---

## 5. Main Relationships

```text
students 1 --- n enrollments n --- 1 classes
classes n --- 1 subjects
classes n --- 1 teachers
classes n --- 1 rooms
classes 1 --- n class_schedules
classes 1 --- n class_sessions
class_sessions 1 --- n attendance
students 1 --- n attendance
students n --- n parents through student_parents
students 1 --- n invoices
invoices 1 --- n payments
classes 1 --- n assignments
assignments 1 --- n assignment_questions
students 1 --- n assignment_submissions
assignment_submissions 1 --- n student_answers
learning_topics 1 --- n assignment_questions
students 1 --- n progress_reports
```

---

## 6. Reporting Views

### `v_student_topic_performance`

Shows performance by student, class, subject, and topic.

Important output columns:

```text
student_id
student_code
student_name
class_id
class_name
subject_id
subject_name
topic_id
topic_name
total_questions
total_score
max_score
mastery_percent
```

Use this view to see how well a student performs in each topic.

### `v_student_weak_topics`

Shows only weak topics.

Rule:

```text
mastery_percent < 60
```

Example query:

```sql
select *
from v_student_weak_topics
order by student_name, mastery_percent asc;
```

### `v_student_assignment_summary`

Shows assignment results by student.

Important output columns:

```text
student_id
student_code
student_name
class_id
class_name
assignment_id
assignment_title
assignment_total_score
submission_status
student_score
score_percent
teacher_feedback
submitted_at
graded_at
```

Example query:

```sql
select *
from v_student_assignment_summary
order by student_name, assignment_title;
```

---

## 7. Sample Login Accounts

The sample accounts are created in `seed.sql`.

```text
Admin:
username: admin
password: Admin@123

Staff:
username: staff01
password: Staff@123

Teacher:
username: teacher01
password: Teacher@123

Parent:
username: parent01
password: Parent@123

Student:
username: student01
password: Student@123
```

The plain passwords above are only for testing. In the database, passwords are stored as hashed values using PostgreSQL `crypt()` from the `pgcrypto` extension.

---

## 8. Useful SQL Queries

### 8.1 Check login manually

```sql
select user_id, username, full_name, role, status
from user_accounts
where username = 'admin'
  and password_hash = crypt('Admin@123', password_hash)
  and status = 'active';
```

If the query returns one row, the login information is correct.

### 8.2 Create a login session

```sql
insert into user_sessions (
    user_id,
    refresh_token_hash,
    ip_address,
    user_agent,
    expires_at
)
values (
    1,
    digest('sample_refresh_token', 'sha256')::text,
    '127.0.0.1',
    'Sample Browser',
    now() + interval '7 days'
);
```

### 8.3 Logout

```sql
update user_sessions
set is_revoked = true,
    logout_at = now()
where session_id = 'PUT_SESSION_ID_HERE';
```

### 8.4 Find weak topics

```sql
select *
from v_student_weak_topics
order by student_name, mastery_percent asc;
```

### 8.5 View assignment summary

```sql
select *
from v_student_assignment_summary
order by student_name, assignment_title;
```

### 8.6 View all students in a class

```sql
select
    c.class_name,
    s.student_code,
    s.full_name,
    e.status,
    e.enrolled_date
from enrollments e
join students s on e.student_id = s.student_id
join classes c on e.class_id = c.class_id
where c.class_id = 1
order by s.full_name;
```

### 8.7 View attendance by student

```sql
select
    s.full_name,
    c.class_name,
    cs.session_date,
    cs.topic,
    a.status,
    a.check_in_time
from attendance a
join students s on a.student_id = s.student_id
join class_sessions cs on a.session_id = cs.session_id
join classes c on cs.class_id = c.class_id
where s.student_id = 1
order by cs.session_date;
```

### 8.8 View unpaid invoices

```sql
select
    i.invoice_id,
    s.full_name as student_name,
    c.class_name,
    i.invoice_month,
    i.invoice_year,
    i.final_amount,
    i.due_date,
    i.status
from invoices i
join students s on i.student_id = s.student_id
left join classes c on i.class_id = c.class_id
where i.status in ('unpaid', 'partial')
order by i.due_date;
```

---

## 9. Suggested API Modules

A backend or AI coding agent should generate APIs based on these modules:

```text
auth
students
parents
teachers
subjects
rooms
classes
schedules
enrollments
sessions
attendance
assignments
submissions
reports
invoices
payments
```

Recommended first CRUD order:

```text
1. auth
2. students
3. teachers
4. subjects
5. rooms
6. classes
7. enrollments
8. assignments
9. reports
10. invoices
11. payments
```

---

## 10. Notes for AI Coding Agents

Before generating backend code, read these files first:

```text
database/schema.sql
database/seed.sql
database/README_DATABASE.md
```

Important rules:

```text
- Do not invent new table names unless necessary.
- Use the existing primary keys and foreign keys.
- Use user_accounts for login.
- Use user_sessions for logout/session tracking.
- Use login_logs to record login attempts.
- Use learning_topics, assignment_questions, and student_answers to detect weak topics.
- Use progress_reports to store reports sent to parents or students.
- Use invoices and payments for tuition fee management.
```

---

## 11. Security Notes

Do not commit real secrets to GitHub.

Never commit:

```text
.env
.env.local
Supabase service role key
real database password
JWT secret
production API keys
```

Commit only a safe example file such as:

```text
.env.example
```

Example:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
SUPABASE_URL="YOUR_SUPABASE_URL"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

If Row Level Security is enabled in Supabase, API access may be blocked until policies are created. For a beginner project, it is recommended to access the database through a backend API instead of exposing database logic directly in the frontend.
