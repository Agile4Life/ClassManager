begin;

alter table classes
alter column teacher_id drop not null;

commit;
