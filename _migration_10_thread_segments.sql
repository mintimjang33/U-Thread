-- 타래 다단 생성(스레드 세그먼트) — 첫 글은 content, 이어지는 타래는 이 배열에 순서대로 저장.
alter table ut_thread_posts add column if not exists thread_segments text[];
