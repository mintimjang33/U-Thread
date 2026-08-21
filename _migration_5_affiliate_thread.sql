-- 유쓰레드 5차 마이그레이션 (제휴 타래 추가)
alter table ut_thread_posts add column if not exists affiliate_comment text;
