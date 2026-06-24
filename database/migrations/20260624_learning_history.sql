-- Run this file ONCE on an existing ClassManager database.
-- It is additive and does not delete current data.

begin;

alter table progress_reports
    add column if not exists report_source varchar(30) not null default 'manual',
    add column if not exists source_key varchar(100);

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'chk_report_source'
    ) then
        alter table progress_reports
            add constraint chk_report_source
            check (report_source in ('manual', 'learning_history'));
    end if;
end $$;

create table if not exists student_learning_events (
    event_id bigint generated always as identity primary key,
    student_id bigint not null references students(student_id) on delete cascade,
    class_id bigint references classes(class_id) on delete set null,
    teacher_id bigint references teachers(teacher_id) on delete set null,
    recorded_by_user_id bigint references user_accounts(user_id) on delete set null,
    report_id bigint references progress_reports(report_id) on delete set null,
    category_key varchar(100) not null,
    category_label varchar(200) not null,
    detail text not null,
    student_note varchar(200),
    notification_text text,
    created_at timestamptz not null default now()
);

create unique index if not exists uq_learning_history_report
    on progress_reports(student_id, report_source, source_key)
    where report_source = 'learning_history';
create index if not exists idx_learning_events_student_category
    on student_learning_events(student_id, category_key, created_at desc);
create index if not exists idx_learning_events_class_created
    on student_learning_events(class_id, created_at desc);

commit;
