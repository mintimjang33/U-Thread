-- 유쓰레드 8차 마이그레이션 (게시물 상태관리/예약발행)
-- 상태: draft(임시저장) / scheduled(예약 대기) / publishing(발행 중) / posted(발행 완료) / failed(발행 실패)

alter table ut_thread_posts drop constraint if exists ut_thread_posts_status_check;
alter table ut_thread_posts add constraint ut_thread_posts_status_check
  check (status in ('draft', 'scheduled', 'publishing', 'posted', 'failed'));

alter table ut_thread_posts add column if not exists scheduled_at timestamptz;
alter table ut_thread_posts add column if not exists publish_error text;

create index if not exists ut_thread_posts_scheduled_idx on ut_thread_posts (status, scheduled_at) where status = 'scheduled';
