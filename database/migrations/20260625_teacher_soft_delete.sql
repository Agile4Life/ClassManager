alter table teachers
add column if not exists is_deleted boolean not null default false;

create index if not exists idx_teachers_not_deleted
    on teachers(teacher_id)
    where is_deleted = false;
