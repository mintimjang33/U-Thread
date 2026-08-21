-- 유쓰레드 전용 테이블. UShort와 같은 Supabase 프로젝트를 공유하므로
-- 이름 충돌 방지를 위해 ut_ 접두사를 씁니다. Supabase SQL Editor에서 실행하세요.

create table if not exists ut_benchmark_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  source text,
  content text not null,
  created_at timestamptz not null default now()
);
alter table ut_benchmark_items enable row level security;

create table if not exists ut_revenue_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  amount integer not null,
  content text,
  image_url text,
  likes integer not null default 0,
  views integer not null default 0,
  created_at timestamptz not null default now()
);
alter table ut_revenue_posts enable row level security;

-- BYOK Vault: GEMINI / COUPANG / TOSS. 값 자체는 AES-256-GCM으로 암호화한 문자열만 저장한다
-- (lib/vaultCrypto.ts 참고) — DB가 털려도 VAULT_MASTER_KEY 없이는 복호화 불가능.
create table if not exists ut_api_keys_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('GEMINI', 'COUPANG', 'TOSS')),
  encrypted_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);
alter table ut_api_keys_vault enable row level security;
