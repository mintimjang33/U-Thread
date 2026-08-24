alter table ut_account_plans
  add column if not exists actual_gmail text,
  add column if not exists actual_instagram_handle text,
  add column if not exists actual_subaccounts text,
  add column if not exists threads_account_id uuid references ut_threads_accounts(id) on delete set null;
