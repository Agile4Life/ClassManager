-- Safe performance indexes for an existing ClassManager database.
-- This file does not delete or rewrite data.

create index if not exists idx_enrollments_class_attendance
    on enrollments(class_id, student_id)
    where status in ('studying', 'completed');

create index if not exists idx_class_sessions_class_date
    on class_sessions(class_id, session_date desc);

create index if not exists idx_login_logs_user_created_at
    on login_logs(user_id, created_at desc);

create index if not exists idx_payments_invoice_id
    on payments(invoice_id);

create index if not exists idx_class_schedules_room_day
    on class_schedules(room_id, day_of_week);

create index if not exists idx_class_schedules_class_id
    on class_schedules(class_id);
