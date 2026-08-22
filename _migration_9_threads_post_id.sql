-- 발행된 게시물의 실제 Threads 미디어 ID를 저장(삭제 기능에 필요).
alter table ut_thread_posts add column if not exists threads_post_id text;

-- 발행 시 인스타그램 스토리에도 동시 공유할지 여부(예약발행까지 값이 유지되도록 컬럼화).
alter table ut_thread_posts add column if not exists share_to_instagram boolean not null default false;
