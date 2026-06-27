-- BATIG Database Schema
-- Run this in Supabase → SQL Editor → New Query → Run

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  phone text default '',
  balance numeric not null default 500,
  referral_code text unique not null,
  referred_by uuid references users(id),
  wins int not null default 0,
  rounds int not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists rounds (
  id bigint primary key,
  winner int check (winner between 1 and 6),
  bets jsonb not null default '[0,0,0,0,0,0]'::jsonb,
  pool numeric not null default 0,
  house_pl numeric not null default 0,
  player_count int not null default 0,
  resolved boolean not null default false,
  resolved_at timestamptz
);

create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  round_id bigint not null references rounds(id) on delete cascade,
  number int not null check (number between 1 and 6),
  amount numeric not null check (amount > 0),
  won boolean,
  payout numeric not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, round_id)
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references users(id) on delete cascade,
  referred_id uuid not null references users(id) on delete cascade,
  bonus numeric not null default 100,
  created_at timestamptz not null default now(),
  unique(referred_id)
);

create table if not exists house_stats (
  id int primary key default 1 check (id = 1),
  profit numeric not null default 0,
  today_profit numeric not null default 0,
  today_date date,
  total_rounds int not null default 0
);

insert into house_stats (id) values (1) on conflict (id) do nothing;

-- Allow browser signup with anon key (required for direct auth)
alter table users disable row level security;
alter table rounds disable row level security;
alter table bets disable row level security;
alter table referrals disable row level security;
alter table house_stats disable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

create index if not exists idx_bets_round on bets(round_id);
create index if not exists idx_bets_user on bets(user_id);
create index if not exists idx_users_referral on users(referral_code);
