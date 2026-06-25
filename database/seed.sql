-- =========================================================
-- CLASSMANAGER - SAMPLE DATA
-- File: seed.sql
-- Database: PostgreSQL / Supabase
--
-- Run this file AFTER schema.sql.
-- It inserts sample subjects, teachers, rooms, students,
-- parents, classes, schedules, attendance, users, assignments,
-- reports, invoices, and payments.
--
-- NOTE:
-- This seed file assumes the database was freshly created by schema.sql.
-- If you run it multiple times, unique constraints may cause duplicate errors.
-- =========================================================

-- =========================================================
-- 1. SUBJECTS
-- =========================================================

insert into subjects (subject_code, subject_name, description)
values
('MATH', 'Mathematics', 'Mathematics for secondary and high school students'),
('ENG', 'English', 'English grammar, communication, and exam preparation'),
('PHY', 'Physics', 'Physics classes for grade 8 to grade 12'),
('CHEM', 'Chemistry', 'Chemistry classes for grade 8 to grade 12'),
('LIT', 'Literature', 'Vietnamese literature and writing skills');

-- =========================================================
-- 2. TEACHERS
-- =========================================================

insert into teachers (teacher_code, full_name, phone, email, specialization, hourly_rate)
values
('T001', 'Nguyen Van Minh', '0911000001', 'minh.teacher@example.com', 'Mathematics', 200000),
('T002', 'Tran Thi Lan', '0911000002', 'lan.teacher@example.com', 'English', 180000),
('T003', 'Le Quang Huy', '0911000003', 'huy.teacher@example.com', 'Physics', 220000);

-- =========================================================
-- 3. ROOMS
-- =========================================================

insert into rooms (room_name, capacity, location)
values
('Room A101', 25, 'Floor 1'),
('Room A102', 20, 'Floor 1'),
('Room B201', 30, 'Floor 2');

-- =========================================================
-- 4. STUDENTS
-- =========================================================

insert into students (
    student_code, full_name, date_of_birth, gender, phone, email,
    address, school_name, grade_level
)
values
('S001', 'Pham Minh Khang', '2010-05-12', 'male', '0922000001', 'khang@example.com',
 'Ho Chi Minh City', 'Nguyen Du Secondary School', 'Grade 9'),

('S002', 'Le Ngoc Anh', '2011-08-20', 'female', '0922000002', 'anh@example.com',
 'Ho Chi Minh City', 'Tran Phu Secondary School', 'Grade 8'),

('S003', 'Tran Duc Bao', '2009-03-15', 'male', '0922000003', 'bao@example.com',
 'Ho Chi Minh City', 'Le Quy Don High School', 'Grade 10');

-- =========================================================
-- 5. PARENTS
-- =========================================================

insert into parents (full_name, phone, email, address, occupation)
values
('Pham Van Hung', '0933000001', 'hung.parent@example.com', 'Ho Chi Minh City', 'Engineer'),
('Nguyen Thi Hoa', '0933000002', 'hoa.parent@example.com', 'Ho Chi Minh City', 'Accountant'),
('Le Van Nam', '0933000003', 'nam.parent@example.com', 'Ho Chi Minh City', 'Business Owner');

insert into student_parents (student_id, parent_id, relationship, is_primary_contact)
values
(1, 1, 'father', true),
(2, 2, 'mother', true),
(3, 3, 'father', true);

-- =========================================================
-- 6. CLASSES
-- =========================================================

insert into classes (
    class_code, class_name, subject_id, teacher_id, room_id,
    grade_level, max_students, tuition_fee, start_date, end_date
)
values
('C001', 'Grade 9 Mathematics - Evening Class', 1, 1, 1, 'Grade 9', 20, 800000, '2026-06-01', '2026-08-31'),
('C002', 'Grade 8 English - Weekend Class', 2, 2, 2, 'Grade 8', 18, 750000, '2026-06-01', '2026-08-31'),
('C003', 'Grade 10 Physics - Advanced Class', 3, 3, 3, 'Grade 10', 25, 900000, '2026-06-01', '2026-08-31');

insert into class_teachers (class_id, teacher_id)
values
(1, 1),
(2, 2),
(3, 3);

-- =========================================================
-- 7. CLASS SCHEDULES
-- =========================================================

insert into class_schedules (class_id, room_id, day_of_week, start_time, end_time)
values
(1, 1, 'monday', '18:00', '19:30'),
(1, 1, 'wednesday', '18:00', '19:30'),
(1, 1, 'friday', '18:00', '19:30'),

(2, 2, 'saturday', '08:00', '10:00'),
(2, 2, 'sunday', '08:00', '10:00'),

(3, 3, 'tuesday', '18:00', '19:30'),
(3, 3, 'thursday', '18:00', '19:30');

insert into class_schedule_teachers (schedule_id, teacher_id)
select cs.schedule_id, ct.teacher_id
from class_schedules cs
join class_teachers ct on ct.class_id = cs.class_id;

-- =========================================================
-- 8. ENROLLMENTS
-- =========================================================

insert into enrollments (student_id, class_id, enrolled_date, status, discount_percent)
values
(1, 1, '2026-06-01', 'studying', 0),
(2, 2, '2026-06-01', 'studying', 5),
(3, 3, '2026-06-01', 'studying', 0);

-- =========================================================
-- 9. CLASS SESSIONS AND ATTENDANCE
-- =========================================================

insert into class_sessions (class_id, session_date, start_time, end_time, topic, status)
values
(1, '2026-06-03', '18:00', '19:30', 'Linear Equations', 'completed'),
(1, '2026-06-05', '18:00', '19:30', 'Quadratic Equations', 'completed'),
(2, '2026-06-07', '08:00', '10:00', 'English Tenses Review', 'completed'),
(3, '2026-06-04', '18:00', '19:30', 'Motion and Forces', 'completed');

insert into attendance (session_id, student_id, status, check_in_time)
values
(1, 1, 'present', '17:55'),
(2, 1, 'late', '18:10'),
(3, 2, 'present', '07:55'),
(4, 3, 'present', '17:50');

-- =========================================================
-- 10. SAMPLE USER ACCOUNTS FOR LOGIN / LOGOUT
--
-- Plain passwords for testing:
-- admin     / Admin@123
-- staff01   / Staff@123
-- teacher01 / Teacher@123
-- parent01  / Parent@123
-- student01 / Student@123
--
-- Passwords are stored as hashes by pgcrypto crypt().
-- =========================================================

insert into user_accounts (
    username, password_hash, full_name, email, phone, role, status
)
values
('admin', crypt('Admin@123', gen_salt('bf')), 'System Admin', 'admin@classmanager.com', '0900000000', 'admin', 'active'),
('staff01', crypt('Staff@123', gen_salt('bf')), 'Center Staff', 'staff01@classmanager.com', '0900000001', 'staff', 'active');

insert into user_accounts (
    username, password_hash, full_name, email, phone, role, status, teacher_id
)
values
('teacher01', crypt('Teacher@123', gen_salt('bf')), 'Nguyen Van Minh', 'teacher01@classmanager.com', '0911000001', 'teacher', 'active', 1);

insert into user_accounts (
    username, password_hash, full_name, email, phone, role, status, parent_id
)
values
('parent01', crypt('Parent@123', gen_salt('bf')), 'Pham Van Hung', 'parent01@classmanager.com', '0933000001', 'parent', 'active', 1);

insert into user_accounts (
    username, password_hash, full_name, email, phone, role, status, student_id
)
values
('student01', crypt('Student@123', gen_salt('bf')), 'Pham Minh Khang', 'student01@classmanager.com', '0922000001', 'student', 'active', 1);

-- Sample session and login log
insert into user_sessions (
    user_id, refresh_token_hash, ip_address, user_agent, expires_at
)
values
(1, digest('sample_refresh_token', 'sha256')::text, '127.0.0.1', 'Sample Browser', now() + interval '7 days');

insert into login_logs (
    user_id, username_input, success, failure_reason, ip_address, user_agent
)
values
(1, 'admin', true, null, '127.0.0.1', 'Sample Browser');

-- =========================================================
-- 11. FINANCE DATA
-- =========================================================

insert into invoices (
    student_id, class_id, invoice_month, invoice_year,
    total_amount, discount_amount, final_amount, due_date, status
)
values
(1, 1, 6, 2026, 800000, 0, 800000, '2026-06-10', 'unpaid'),
(2, 2, 6, 2026, 750000, 37500, 712500, '2026-06-10', 'partial'),
(3, 3, 6, 2026, 900000, 0, 900000, '2026-06-10', 'paid');

insert into payments (
    invoice_id, student_id, class_id, amount,
    payment_date, payment_method, status, transaction_code
)
values
(2, 2, 2, 300000, '2026-06-05', 'cash', 'paid', null),
(3, 3, 3, 900000, '2026-06-04', 'bank_transfer', 'paid', 'BANK20260604001');

-- =========================================================
-- 12. LEARNING TOPICS
-- =========================================================

insert into learning_topics (subject_id, topic_name, description, difficulty_level)
values
(1, 'Linear Equations', 'Solving one-variable linear equations', 'medium'),
(1, 'Quadratic Equations', 'Solving quadratic equations', 'hard'),
(1, 'Geometry Basics', 'Basic geometry formulas and shapes', 'medium'),
(2, 'English Tenses', 'Present, past, and future tenses', 'medium'),
(2, 'Reading Comprehension', 'Reading and understanding short passages', 'hard'),
(3, 'Motion and Forces', 'Basic physics motion and force concepts', 'medium');

-- =========================================================
-- 13. ASSIGNMENTS, QUESTIONS, SUBMISSIONS, ANSWERS
-- =========================================================

insert into assignments (
    class_id, teacher_id, title, description, assigned_date, due_date, total_score, status
)
values
(1, 1, 'Mathematics Homework Week 1', 'Practice linear equations and quadratic equations', current_date, current_date + 7, 10, 'assigned'),
(2, 2, 'English Homework Week 1', 'Practice English tenses and reading comprehension', current_date, current_date + 7, 10, 'assigned');

insert into assignment_questions (
    assignment_id, topic_id, question_no, question_text,
    question_type, difficulty_level, max_score, correct_answer
)
values
(1, 1, 1, 'Solve: 2x + 3 = 11', 'calculation', 'easy', 2, 'x = 4'),
(1, 1, 2, 'Solve: 5x - 7 = 18', 'calculation', 'medium', 2, 'x = 5'),
(1, 2, 3, 'Solve: x^2 - 5x + 6 = 0', 'calculation', 'hard', 3, 'x = 2 or x = 3'),
(1, 2, 4, 'Solve: x^2 - 9 = 0', 'calculation', 'medium', 3, 'x = 3 or x = -3'),

(2, 4, 1, 'Choose the correct tense: She ____ to school every day.', 'multiple_choice', 'easy', 2, 'goes'),
(2, 5, 2, 'Read the passage and answer the main idea.', 'short_answer', 'medium', 8, 'Main idea depends on passage');

insert into assignment_submissions (
    assignment_id, student_id, submitted_at, status, total_score, teacher_feedback, graded_at
)
values
(1, 1, now(), 'graded', 5, 'Student understands basic linear equations but needs more practice with quadratic equations.', now()),
(2, 2, now(), 'graded', 7, 'Student understands basic tenses but needs to improve reading comprehension.', now());

insert into student_answers (
    submission_id, question_id, student_answer, score, is_correct, teacher_comment
)
values
(1, 1, 'x = 4', 2, true, 'Good'),
(1, 2, 'x = 5', 2, true, 'Good'),
(1, 3, 'x = 1 and x = 6', 0, false, 'Need to review factoring method'),
(1, 4, 'x = 3', 1, false, 'Missing x = -3'),

(2, 5, 'goes', 2, true, 'Good'),
(2, 6, 'Not clear', 5, false, 'Needs more reading practice');

-- =========================================================
-- 14. PROGRESS REPORT
-- =========================================================

insert into progress_reports (
    student_id, class_id, teacher_id, parent_id,
    report_title,
    period_start, period_end,
    homework_summary,
    attendance_summary,
    strength_summary,
    weakness_summary,
    teacher_recommendation,
    parent_note,
    status,
    sent_at
)
values
(
    1, 1, 1, 1,
    'Monthly Study Report - June 2026',
    '2026-06-01', '2026-06-30',
    'Student completed the homework but lost points in quadratic equation questions.',
    'Student attended most sessions but was late once.',
    'Good understanding of linear equations.',
    'Needs more practice with quadratic equations and factoring methods.',
    'Practice 10 additional quadratic equation exercises before next class.',
    null,
    'sent',
    now()
);

-- =========================================================
-- 15. USEFUL TEST QUERIES
-- Copy and run these later in SQL Editor if needed.
-- =========================================================

-- Check login manually:
-- If this returns one row, login is correct.
--
-- select user_id, username, full_name, role, status
-- from user_accounts
-- where username = 'admin'
--   and password_hash = crypt('Admin@123', password_hash)
--   and status = 'active';

-- Logout manually:
--
-- update user_sessions
-- set is_revoked = true,
--     logout_at = now()
-- where session_id = 'PUT_SESSION_ID_HERE';

-- Check weak topics:
--
-- select *
-- from v_student_weak_topics
-- order by student_name, mastery_percent asc;

-- Check assignment summary:
--
-- select *
-- from v_student_assignment_summary
-- order by student_name, assignment_title;

-- =========================================================
-- END OF seed.sql
-- =========================================================
