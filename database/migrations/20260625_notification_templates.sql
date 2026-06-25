begin;

create table if not exists notification_templates (
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

alter table notification_templates
add column if not exists class_id bigint references classes(class_id) on delete cascade;

create index if not exists idx_notification_templates_active
    on notification_templates(created_at desc)
    where is_deleted = false;

create index if not exists idx_notification_templates_class_active
    on notification_templates(class_id, created_at desc)
    where is_deleted = false;

commit;
