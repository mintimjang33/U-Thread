-- 구독/프리미엄 게이팅. 실제 결제(토스페이먼츠)는 아직 연동 전이라, is_subscribed를
-- 수동으로 켜고 끌 수 있게만 만들어둔다(구독하기 버튼 눌렀을 때 임시로 30일 부여).
create table if not exists ut_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_subscribed boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table ut_subscriptions enable row level security;
