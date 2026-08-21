-- 유쓰레드 4차 마이그레이션 (Threads OAuth)
-- Supabase SQL Editor에서 실행하세요.

create table if not exists ut_threads_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  threads_user_id text not null,
  username text,
  encrypted_access_token text not null,
  token_expires_at timestamptz,
  default_persona_id uuid,
  default_persona_is_system boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, threads_user_id)
);
alter table ut_threads_accounts enable row level security;

alter table ut_thread_posts add column if not exists threads_account_id uuid references ut_threads_accounts(id) on delete set null;

