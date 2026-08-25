-- 워커 GUI "계정" 탭의 쓰레드 로그인 확인 기능이 쓰는 새 job 타입을 허용 목록에 추가.
alter table ut_worker_jobs drop constraint if exists ut_worker_jobs_type_check;
alter table ut_worker_jobs add constraint ut_worker_jobs_type_check
  check (type in ('generate', 'collect_benchmark', 'check_threads_login'));
