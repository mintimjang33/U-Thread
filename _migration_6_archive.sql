-- 유쓰레드 6차 마이그레이션 (유쓰레드 아카이브 — 숏폼 제품영상 소재 라이브러리)
-- 원본은 운영자가 수동 큐레이션한 영상 풀이라 콘텐츠 자체는 빈 상태로 시작하고,
-- 사용자들이 직접 업로드해서 채워나가는 공유 라이브러리로 구현함.
create table if not exists ut_archive_videos (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid references auth.users(id) on delete set null,
  category text not null,
  title text not null,
  hashtags text[] not null default '{}',
  video_url text not null,
  created_at timestamptz not null default now()
);
alter table ut_archive_videos enable row level security;
