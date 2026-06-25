-- =========================================================
-- CLASSMANAGER - TUITION CENTER MANAGEMENT DATABASE
-- File: schema.sql
-- Database: PostgreSQL / Supabase
--
-- This file creates the full database structure:
-- Login / Logout, students, parents, teachers, subjects,
-- classes, schedules, attendance, assignments, reports,
-- invoices, payments, and reporting views.
--
-- WARNING:
-- This schema contains DROP statements. Running it will remove
-- existing tables/views with the same names.
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- DROP OLD OBJECTS
-- =========================================================

drop view if exists v_student_assignment_summary cascade;
drop view if exists v_student_weak_topics cascade;
drop view if exists v_student_topic_performance cascade;

drop table if exists password_reset_tokens cascade;
drop table if exists login_logs cascade;
drop table if exists user_sessions cascade;
drop table if exists user_accounts cascade;

drop table if exists student_learning_events cascade;
drop table if exists progress_reports cascade;
drop table if exists student_answers cascade;
drop table if exists assignment_submissions cascade;
drop table if exists assignment_questions cascade;
drop table if exists assignments cascade;
drop table if exists learning_topics cascade;

drop table if exists payments cascade;
drop table if exists invoices cascade;
drop table if exists attendance cascade;
drop table if exists class_sessions cascade;
drop table if exists enrollments cascade;
drop table if exists class_schedule_teachers cascade;
drop table if exists class_schedules cascade;
drop table if exists class_teachers cascade;
drop table if exists classes cascade;
drop table if exists rooms cascade;
drop table if exists subjects cascade;
drop table if exists student_parents cascade;
drop table if exists parents cascade;
drop table if exists students cascade;
drop table if exists teachers cascade;
drop table if exists staff_users cascade;

-- =========================================================
-- 1. STUDENTS
-- =========================================================

create table students (
    student_id bigint generated always as identity primary key,
    student_code varchar(30) not null unique,
    full_name varchar(100) not null,
    date_of_birth date,
    gender varchar(20),
    phone varchar(20),
    email varchar(100),
    address text,
    school_name varchar(150),
    grade_level varchar(30),
    status varchar(20) not null default 'active',
    note text,
    created_at timestamptz not null default now(),

    constraint chk_student_gender
        check (gender is null or gender in ('male', 'female', 'other')),

    constraint chk_student_status
        check (status in ('active', 'inactive', 'graduated', 'paused'))
);

-- =========================================================
-- 2. PARENTS
-- =========================================================

create table parents (
    parent_id bigint generated always as identity primary key,
    full_name varchar(100) not null,
    phone varchar(20) not null,
    email varchar(100),
    address text,
    occupation varchar(100),
    created_at timestamptz not null default now()
);

create table student_parents (
    student_id bigint not null references students(student_id) on delete cascade,
    parent_id bigint not null references parents(parent_id) on delete cascade,
    relationship varchar(30) not null,
    is_primary_contact boolean not null default false,

    primary key (student_id, parent_id),

    constraint chk_relationship
        check (relationship in ('father', 'mother', 'guardian', 'other'))
);

-- =========================================================
-- 3. TEACHERS
-- =========================================================

create table teachers (
    teacher_id bigint generated always as identity primary key,
    teacher_code varchar(30) not null unique,
    full_name varchar(100) not null,
    phone varchar(20),
    email varchar(100) unique,
    address text,
    specialization varchar(100),
    hourly_rate numeric(12,2) default 0,
    status varchar(20) not null default 'active',
    is_deleted boolean not null default false,
    note text,
    created_at timestamptz not null default now(),

    constraint chk_teacher_status
        check (status in ('active', 'inactive', 'paused')),

    constraint chk_teacher_hourly_rate
        check (hourly_rate >= 0)
);

-- =========================================================
-- 4. SUBJECTS
-- =========================================================

create table subjects (
    subject_id bigint generated always as identity primary key,
    subject_code varchar(30) not null unique,
    subject_name varchar(100) not null,
    description text,
    status varchar(20) not null default 'active',
    created_at timestamptz not null default now(),

    constraint chk_subject_status
        check (status in ('active', 'inactive'))
);

-- =========================================================
-- 5. ROOMS
-- =========================================================

create table rooms (
    room_id bigint generated always as identity primary key,
    room_name varchar(50) not null unique,
    capacity int not null,
    location varchar(150),
    status varchar(20) not null default 'available',
    created_at timestamptz not null default now(),

    constraint chk_room_capacity
        check (capacity > 0),

    constraint chk_room_status
        check (status in ('available', 'maintenance', 'inactive'))
);

-- =========================================================
-- 6. CLASSES
-- =========================================================

create table classes (
    class_id bigint generated always as identity primary key,
    class_code varchar(30) not null unique,
    class_name varchar(150) not null,

    subject_id bigint not null references subjects(subject_id),
    teacher_id bigint references teachers(teacher_id),
    room_id bigint references rooms(room_id),

    grade_level varchar(30),
    max_students int not null default 40,
    tuition_fee numeric(12,2) not null default 0,

    start_date date,
    end_date date,

    status varchar(20) not null default 'active',
    note text,
    created_at timestamptz not null default now(),

    constraint chk_class_max_students
        check (max_students > 0),

    constraint chk_class_tuition_fee
        check (tuition_fee >= 0),

    constraint chk_class_status
        check (status in ('active', 'completed', 'cancelled', 'paused')),

    constraint chk_class_date
        check (end_date is null or start_date is null or end_date >= start_date)
);

create table class_teachers (
    class_id bigint not null references classes(class_id) on delete cascade,
    teacher_id bigint not null references teachers(teacher_id) on delete cascade,
    assigned_at timestamptz not null default now(),
    primary key (class_id, teacher_id)
);

-- =========================================================
-- 7. CLASS SCHEDULES
-- Fixed weekly schedule for each class
-- =========================================================

create table class_schedules (
    schedule_id bigint generated always as identity primary key,
    class_id bigint not null references classes(class_id) on delete cascade,
    room_id bigint references rooms(room_id),

    day_of_week varchar(20) not null,
    start_time time not null,
    end_time time not null,

    created_at timestamptz not null default now(),

    constraint chk_day_of_week
        check (day_of_week in (
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday'
        )),

    constraint chk_schedule_time
        check (end_time > start_time)
);

create table class_schedule_teachers (
    schedule_id bigint not null references class_schedules(schedule_id) on delete cascade,
    teacher_id bigint not null references teachers(teacher_id) on delete cascade,
    primary key (schedule_id, teacher_id)
);

-- =========================================================
-- 8. ENROLLMENTS
-- Student joins class
-- =========================================================

create table enrollments (
    enrollment_id bigint generated always as identity primary key,

    student_id bigint not null references students(student_id) on delete cascade,
    class_id bigint not null references classes(class_id) on delete cascade,

    enrolled_date date not null default current_date,
    status varchar(20) not null default 'studying',
    discount_percent numeric(5,2) not null default 0,
    note text,
    created_at timestamptz not null default now(),

    constraint uq_student_class unique (student_id, class_id),

    constraint chk_enrollment_status
        check (status in ('studying', 'completed', 'dropped', 'paused')),

    constraint chk_discount_percent
        check (discount_percent >= 0 and discount_percent <= 100)
);

-- =========================================================
-- 9. CLASS SESSIONS
-- Real study sessions
-- =========================================================

create table class_sessions (
    session_id bigint generated always as identity primary key,

    class_id bigint not null references classes(class_id) on delete cascade,
    session_date date not null,
    start_time time,
    end_time time,

    topic varchar(200),
    status varchar(20) not null default 'scheduled',
    note text,
    created_at timestamptz not null default now(),

    constraint chk_session_status
        check (status in ('scheduled', 'completed', 'cancelled')),

    constraint chk_session_time
        check (end_time is null or start_time is null or end_time > start_time)
);

-- =========================================================
-- 10. ATTENDANCE
-- =========================================================

create table attendance (
    attendance_id bigint generated always as identity primary key,

    session_id bigint not null references class_sessions(session_id) on delete cascade,
    student_id bigint not null references students(student_id) on delete cascade,

    status varchar(20) not null default 'present',
    check_in_time time,
    note text,
    created_at timestamptz not null default now(),

    constraint uq_attendance_session_student unique (session_id, student_id),

    constraint chk_attendance_status
        check (status in ('present', 'absent', 'late', 'excused'))
);

-- =========================================================
-- 11. LOGIN / LOGOUT TABLES
-- =========================================================

create table user_accounts (
    user_id bigint generated always as identity primary key,

    username varchar(50) not null unique,
    password_hash text not null,

    full_name varchar(100) not null,
    email varchar(100) unique,
    phone varchar(20),
    google_sub varchar(255) unique,
    avatar_url text,

    role varchar(20) not null,
    status varchar(20) not null default 'active',

    teacher_id bigint unique references teachers(teacher_id) on delete set null,
    student_id bigint unique references students(student_id) on delete set null,
    parent_id bigint unique references parents(parent_id) on delete set null,

    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint chk_user_role
        check (role in ('admin', 'staff', 'teacher', 'student', 'parent')),

    constraint chk_user_status
        check (status in ('active', 'inactive', 'locked')),

    constraint chk_user_role_link
        check (
            (role in ('admin', 'staff') and teacher_id is null and student_id is null and parent_id is null)
            or
            (role = 'teacher' and teacher_id is not null and student_id is null and parent_id is null)
            or
            (role = 'student' and student_id is not null and teacher_id is null and parent_id is null)
            or
            (role = 'parent' and parent_id is not null and teacher_id is null and student_id is null)
        )
);

create table user_sessions (
    session_id uuid primary key default gen_random_uuid(),

    user_id bigint not null references user_accounts(user_id) on delete cascade,

    refresh_token_hash text,
    ip_address inet,
    user_agent text,

    is_revoked boolean not null default false,
    login_at timestamptz not null default now(),
    logout_at timestamptz,
    expires_at timestamptz not null,

    constraint chk_session_logout
        check (logout_at is null or logout_at >= login_at)
);

create table login_logs (
    login_log_id bigint generated always as identity primary key,

    user_id bigint references user_accounts(user_id) on delete set null,
    username_input varchar(100),

    success boolean not null,
    failure_reason varchar(200),

    ip_address inet,
    user_agent text,
    created_at timestamptz not null default now()
);

create table password_reset_tokens (
    reset_token_id uuid primary key default gen_random_uuid(),

    user_id bigint not null references user_accounts(user_id) on delete cascade,

    token_hash text not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now(),

    constraint chk_reset_token_used
        check (used_at is null or used_at >= created_at)
);

-- =========================================================
-- 12. INVOICES
-- =========================================================

create table invoices (
    invoice_id bigint generated always as identity primary key,

    student_id bigint not null references students(student_id),
    class_id bigint references classes(class_id),

    invoice_month int not null,
    invoice_year int not null,

    total_amount numeric(12,2) not null default 0,
    discount_amount numeric(12,2) not null default 0,
    final_amount numeric(12,2) not null default 0,

    due_date date,
    status varchar(20) not null default 'unpaid',
    note text,
    created_at timestamptz not null default now(),

    constraint chk_invoice_month
        check (invoice_month between 1 and 12),

    constraint chk_invoice_year
        check (invoice_year >= 2000),

    constraint chk_invoice_amount
        check (
            total_amount >= 0
            and discount_amount >= 0
            and final_amount >= 0
        ),

    constraint chk_invoice_status
        check (status in ('unpaid', 'paid', 'partial', 'cancelled')),

    constraint uq_student_class_invoice_month
        unique (student_id, class_id, invoice_month, invoice_year)
);

-- =========================================================
-- 13. PAYMENTS
-- =========================================================

create table payments (
    payment_id bigint generated always as identity primary key,

    invoice_id bigint references invoices(invoice_id) on delete set null,
    student_id bigint not null references students(student_id),
    class_id bigint references classes(class_id),

    amount numeric(12,2) not null,
    payment_date date not null default current_date,
    payment_method varchar(30) not null default 'cash',
    status varchar(20) not null default 'paid',
    transaction_code varchar(100),
    note text,
    created_at timestamptz not null default now(),

    constraint chk_payment_amount
        check (amount > 0),

    constraint chk_payment_method
        check (payment_method in ('cash', 'bank_transfer', 'momo', 'zalopay', 'other')),

    constraint chk_payment_status
        check (status in ('paid', 'refunded', 'cancelled'))
);

-- =========================================================
-- 14. LEARNING TOPICS
-- Topic / weak skill tracking
-- =========================================================

create table learning_topics (
    topic_id bigint generated always as identity primary key,

    subject_id bigint not null references subjects(subject_id) on delete cascade,

    topic_name varchar(150) not null,
    description text,
    difficulty_level varchar(20) default 'medium',

    status varchar(20) not null default 'active',
    created_at timestamptz not null default now(),

    constraint chk_topic_difficulty
        check (difficulty_level in ('easy', 'medium', 'hard')),

    constraint chk_topic_status
        check (status in ('active', 'inactive')),

    constraint uq_subject_topic unique (subject_id, topic_name)
);

-- =========================================================
-- 15. ASSIGNMENTS
-- =========================================================

create table assignments (
    assignment_id bigint generated always as identity primary key,

    class_id bigint not null references classes(class_id) on delete cascade,
    teacher_id bigint references teachers(teacher_id),

    title varchar(200) not null,
    description text,

    assigned_date date not null default current_date,
    due_date date,

    total_score numeric(6,2) not null default 10,
    status varchar(20) not null default 'assigned',

    created_at timestamptz not null default now(),

    constraint chk_assignment_score
        check (total_score > 0),

    constraint chk_assignment_status
        check (status in ('draft', 'assigned', 'closed', 'cancelled')),

    constraint chk_assignment_due_date
        check (due_date is null or due_date >= assigned_date)
);

-- =========================================================
-- 16. ASSIGNMENT QUESTIONS
-- Each question belongs to a learning topic
-- =========================================================

create table assignment_questions (
    question_id bigint generated always as identity primary key,

    assignment_id bigint not null references assignments(assignment_id) on delete cascade,
    topic_id bigint references learning_topics(topic_id),

    question_no int not null,
    question_text text not null,

    question_type varchar(30) not null default 'short_answer',
    difficulty_level varchar(20) not null default 'medium',

    max_score numeric(6,2) not null default 1,
    correct_answer text,

    created_at timestamptz not null default now(),

    constraint chk_question_no
        check (question_no > 0),

    constraint chk_question_type
        check (question_type in (
            'multiple_choice',
            'short_answer',
            'essay',
            'calculation',
            'true_false',
            'other'
        )),

    constraint chk_question_difficulty
        check (difficulty_level in ('easy', 'medium', 'hard')),

    constraint chk_question_max_score
        check (max_score > 0),

    constraint uq_assignment_question_no unique (assignment_id, question_no)
);

-- =========================================================
-- 17. ASSIGNMENT SUBMISSIONS
-- Student submits assignment
-- =========================================================

create table assignment_submissions (
    submission_id bigint generated always as identity primary key,

    assignment_id bigint not null references assignments(assignment_id) on delete cascade,
    student_id bigint not null references students(student_id) on delete cascade,

    submitted_at timestamptz,
    status varchar(20) not null default 'not_submitted',

    total_score numeric(6,2) default 0,
    teacher_feedback text,

    graded_at timestamptz,
    created_at timestamptz not null default now(),

    constraint uq_assignment_student unique (assignment_id, student_id),

    constraint chk_submission_status
        check (status in ('not_submitted', 'submitted', 'graded', 'late', 'missing')),

    constraint chk_submission_score
        check (total_score is null or total_score >= 0)
);

-- =========================================================
-- 18. STUDENT ANSWERS
-- Score for each question
-- Used to know which topic a student is weak at
-- =========================================================

create table student_answers (
    answer_id bigint generated always as identity primary key,

    submission_id bigint not null references assignment_submissions(submission_id) on delete cascade,
    question_id bigint not null references assignment_questions(question_id) on delete cascade,

    student_answer text,

    score numeric(6,2) not null default 0,
    is_correct boolean,
    teacher_comment text,

    created_at timestamptz not null default now(),

    constraint uq_submission_question unique (submission_id, question_id),

    constraint chk_answer_score
        check (score >= 0)
);

-- =========================================================
-- 19. PROGRESS REPORTS
-- Teacher sends study report to parent/student
-- =========================================================

create table progress_reports (
    report_id bigint generated always as identity primary key,

    student_id bigint not null references students(student_id) on delete cascade,
    class_id bigint references classes(class_id) on delete set null,
    teacher_id bigint references teachers(teacher_id) on delete set null,
    parent_id bigint references parents(parent_id) on delete set null,

    report_title varchar(200) not null,

    period_start date,
    period_end date,

    homework_summary text,
    attendance_summary text,
    strength_summary text,
    weakness_summary text,
    teacher_recommendation text,
    parent_note text,

    status varchar(20) not null default 'draft',
    sent_at timestamptz,

    created_at timestamptz not null default now(),

    constraint chk_report_status
        check (status in ('draft', 'sent', 'archived')),

    constraint chk_report_period
        check (period_end is null or period_start is null or period_end >= period_start)
);

-- =========================================================
-- 20. STUDENT LEARNING HISTORY
-- Every marked notification item is retained for teacher review.
-- =========================================================

create table student_learning_events (
    event_id bigint generated always as identity primary key,
    student_id bigint not null references students(student_id) on delete cascade,
    class_id bigint references classes(class_id) on delete set null,
    teacher_id bigint references teachers(teacher_id) on delete set null,
    recorded_by_user_id bigint references user_accounts(user_id) on delete set null,
    category_key varchar(100) not null,
    category_label varchar(200) not null,
    detail text not null,
    student_note varchar(200),
    notification_text text,
    created_at timestamptz not null default now()
);

create table notification_templates (
    template_id bigint generated always as identity primary key,
    class_id bigint references classes(class_id) on delete cascade,
    label varchar(160) not null,
    content text not null,
    audience varchar(20) not null default 'students',
    created_by_user_id bigint references user_accounts(user_id) on delete set null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),

    constraint chk_notification_template_audience
        check (audience in ('students', 'class'))
);

-- =========================================================
-- 21. INDEXES
-- =========================================================

create index idx_students_full_name on students(full_name);
create index idx_students_phone on students(phone);

create index idx_parents_phone on parents(phone);
create index idx_teachers_full_name on teachers(full_name);
create index idx_notification_templates_active
    on notification_templates(created_at desc)
    where is_deleted = false;
create index idx_notification_templates_class_active
    on notification_templates(class_id, created_at desc)
    where is_deleted = false;

create index idx_classes_subject_id on classes(subject_id);
create index idx_classes_teacher_id on classes(teacher_id);
create index idx_class_teachers_teacher_id on class_teachers(teacher_id);

create index idx_enrollments_student_id on enrollments(student_id);
create index idx_enrollments_class_id on enrollments(class_id);
create index idx_enrollments_class_attendance on enrollments(class_id, student_id)
    where status in ('studying', 'completed');

create index idx_attendance_session_id on attendance(session_id);
create index idx_class_sessions_class_date on class_sessions(class_id, session_date desc);

create index idx_user_accounts_username on user_accounts(username);
create index idx_user_accounts_role on user_accounts(role);
create index idx_user_sessions_user_id on user_sessions(user_id);
create index idx_login_logs_user_id on login_logs(user_id);
create index idx_login_logs_user_created_at on login_logs(user_id, created_at desc);

create index idx_invoices_student_id on invoices(student_id);
create index idx_payments_student_id on payments(student_id);
create index idx_payments_invoice_id on payments(invoice_id);

create index idx_class_schedules_room_day on class_schedules(room_id, day_of_week);
create index idx_class_schedules_class_id on class_schedules(class_id);
create index idx_class_schedule_teachers_teacher_id on class_schedule_teachers(teacher_id);

create index idx_learning_topics_subject_id on learning_topics(subject_id);
create index idx_assignments_class_id on assignments(class_id);
create index idx_assignment_questions_assignment_id on assignment_questions(assignment_id);
create index idx_assignment_questions_topic_id on assignment_questions(topic_id);
create index idx_assignment_submissions_student_id on assignment_submissions(student_id);
create index idx_assignment_submissions_assignment_id on assignment_submissions(assignment_id);
create index idx_student_answers_submission_id on student_answers(submission_id);
create index idx_student_answers_question_id on student_answers(question_id);
create index idx_progress_reports_student_id on progress_reports(student_id);
create index idx_learning_events_student_category
    on student_learning_events(student_id, category_key, created_at desc);
create index idx_learning_events_class_created
    on student_learning_events(class_id, created_at desc);

-- =========================================================
-- 22. REPORTING VIEWS
-- =========================================================

create view v_student_topic_performance as
select
    s.student_id,
    s.student_code,
    s.full_name as student_name,

    c.class_id,
    c.class_name,

    sub.subject_id,
    sub.subject_name,

    lt.topic_id,
    lt.topic_name,

    count(aq.question_id) as total_questions,
    sum(sa.score) as total_score,
    sum(aq.max_score) as max_score,

    round(
        case
            when sum(aq.max_score) = 0 then 0
            else (sum(sa.score) / sum(aq.max_score)) * 100
        end,
        2
    ) as mastery_percent

from student_answers sa
join assignment_questions aq
    on sa.question_id = aq.question_id
join learning_topics lt
    on aq.topic_id = lt.topic_id
join subjects sub
    on lt.subject_id = sub.subject_id
join assignment_submissions asub
    on sa.submission_id = asub.submission_id
join students s
    on asub.student_id = s.student_id
join assignments a
    on asub.assignment_id = a.assignment_id
join classes c
    on a.class_id = c.class_id
    and c.status <> 'cancelled'

group by
    s.student_id,
    s.student_code,
    s.full_name,
    c.class_id,
    c.class_name,
    sub.subject_id,
    sub.subject_name,
    lt.topic_id,
    lt.topic_name;

create view v_student_weak_topics as
select *
from v_student_topic_performance
where mastery_percent < 60;

create view v_student_assignment_summary as
select
    s.student_id,
    s.student_code,
    s.full_name as student_name,

    c.class_id,
    c.class_name,

    a.assignment_id,
    a.title as assignment_title,
    a.total_score as assignment_total_score,

    asub.status as submission_status,
    asub.total_score as student_score,

    round(
        case
            when a.total_score = 0 then 0
            else (asub.total_score / a.total_score) * 100
        end,
        2
    ) as score_percent,

    asub.teacher_feedback,
    asub.submitted_at,
    asub.graded_at

from assignment_submissions asub
join students s
    on asub.student_id = s.student_id
join assignments a
    on asub.assignment_id = a.assignment_id
join classes c
    on a.class_id = c.class_id
    and c.status <> 'cancelled';

-- =========================================================
-- END OF schema.sql
-- =========================================================
