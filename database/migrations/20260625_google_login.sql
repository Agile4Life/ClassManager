-- Run this file once on existing databases before enabling Google login.

alter table user_accounts
    add column if not exists google_sub text,
    add column if not exists avatar_url text;

create unique index if not exists idx_user_accounts_google_sub
    on user_accounts(google_sub)
    where google_sub is not null;
