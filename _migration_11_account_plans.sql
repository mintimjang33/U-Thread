create table if not exists ut_account_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  target_age text,
  target_gender text,
  category text,
  step_gmail boolean not null default false,
  step_instagram boolean not null default false,
  step_subaccount boolean not null default false,
  step_threads_connected boolean not null default false,
  persona_id uuid,
  persona_is_system boolean not null default false,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table ut_account_plans enable row level security;
create index if not exists ut_account_plans_user_idx on ut_account_plans(user_id);
