create table if not exists ut_thread_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid references ut_personas(id) on delete set null,
  topic text,
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'posted')),
  created_at timestamptz not null default now()
);
alter table ut_thread_posts enable row level security;
