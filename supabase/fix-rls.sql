-- BATIG: Fix "row-level security policy" blocking signup
-- Supabase → SQL Editor → New query → paste ALL → Run

alter table if exists users disable row level security;
alter table if exists rounds disable row level security;
alter table if exists bets disable row level security;
alter table if exists referrals disable row level security;
alter table if exists house_stats disable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
