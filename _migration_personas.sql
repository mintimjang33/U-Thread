create table if not exists ut_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tone_prompt text,
  target_prompt text,
  created_at timestamptz not null default now()
);
alter table ut_personas enable row level security;
