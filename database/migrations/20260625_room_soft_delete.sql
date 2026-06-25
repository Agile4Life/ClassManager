-- Add soft delete column to rooms table
alter table rooms add column if not exists is_deleted boolean not null default false;
create index if not exists idx_rooms_not_deleted on rooms(room_id) where is_deleted = false;
