begin;

create table if not exists class_teachers (
    class_id bigint not null references classes(class_id) on delete cascade,
    teacher_id bigint not null references teachers(teacher_id) on delete cascade,
    assigned_at timestamptz not null default now(),
    primary key (class_id, teacher_id)
);

create table if not exists class_schedule_teachers (
    schedule_id bigint not null references class_schedules(schedule_id) on delete cascade,
    teacher_id bigint not null references teachers(teacher_id) on delete cascade,
    primary key (schedule_id, teacher_id)
);

create index if not exists idx_class_teachers_teacher_id on class_teachers(teacher_id);
create index if not exists idx_class_schedule_teachers_teacher_id on class_schedule_teachers(teacher_id);

insert into class_teachers (class_id, teacher_id)
select class_id, teacher_id
from classes
where teacher_id is not null
on conflict do nothing;

insert into class_schedule_teachers (schedule_id, teacher_id)
select cs.schedule_id, c.teacher_id
from class_schedules cs
join classes c on c.class_id = cs.class_id
where c.teacher_id is not null
on conflict do nothing;

commit;
