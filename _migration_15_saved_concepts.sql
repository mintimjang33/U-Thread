create table if not exists ut_saved_concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  daily text[] not null default '{}',
  intro text[] not null default '{}',
  backstory text,
  persona_name text,
  created_at timestamptz not null default now()
);
alter table ut_saved_concepts enable row level security;
