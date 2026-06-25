begin;

alter table classes
alter column teacher_id drop not null;

alter table teachers
add column if not exists is_deleted boolean not null default false;

create table if not exists class_teachers (
    class_id bigint not null references classes(class_id) on delete cascade,
    teacher_id bigint not null references teachers(teacher_id) on delete cascade,
    primary key (class_id, teacher_id)
);

create table if not exists class_schedule_teachers (
    schedule_id bigint not null references class_schedules(schedule_id) on delete cascade,
    teacher_id bigint not null references teachers(teacher_id) on delete cascade,
    primary key (schedule_id, teacher_id)
);

create index if not exists idx_class_teachers_teacher_id on class_teachers(teacher_id);
create index if not exists idx_class_schedule_teachers_teacher_id on class_schedule_teachers(teacher_id);

commit;
