alter table ut_account_plans add column if not exists suggested_handle text;
alter table ut_saved_concepts add column if not exists target_age text;
alter table ut_saved_concepts add column if not exists handle text;
