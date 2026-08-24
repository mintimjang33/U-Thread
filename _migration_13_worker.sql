-- 로컬 워커(사용자 PC에서 도는 클로드 구독 기반 생성 + 벤치마킹 자동수집 프로그램) 연동

create table if not exists ut_worker_pairing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  label text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
alter table ut_worker_pairing enable row level security;

create table if not exists ut_worker_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('generate', 'collect_benchmark')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  input jsonb not null default '{}',
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table ut_worker_jobs enable row level security;
create index if not exists ut_worker_jobs_user_status_idx on ut_worker_jobs(user_id, status);

alter table ut_editor_defaults
  add column if not exists ai_source text not null default 'gemini' check (ai_source in ('gemini', 'worker'));
