alter table ut_account_plans
  add column if not exists ratio_daily int not null default 3,
  add column if not exists ratio_shopping int not null default 1,
  add column if not exists viral_view_threshold int not null default 10000,
  add column if not exists viral_unlocked boolean not null default false,
  add column if not exists mission_cycle_position int not null default 0;
