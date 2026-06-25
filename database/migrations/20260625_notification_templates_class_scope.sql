begin;

alter table notification_templates
add column if not exists class_id bigint references classes(class_id) on delete cascade;

create index if not exists idx_notification_templates_class_active
    on notification_templates(class_id, created_at desc)
    where is_deleted = false;

commit;
