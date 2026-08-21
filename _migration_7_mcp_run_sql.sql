-- 유쓰레드 7차 마이그레이션 (MCP 서버용 읽기전용 SQL 실행 RPC)
-- SELECT 문만 허용하는 안전한 SQL 실행 함수. MCP의 run_sql 도구가 사용한다.
create or replace function ut_mcp_run_sql(query text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  normalized text := lower(trim(query));
begin
  if normalized !~ '^select\s' and normalized !~ '^select\*' and normalized !~ '^\(select' then
    raise exception 'Only SELECT statements are allowed';
  end if;
  if normalized ~ '(insert|update|delete|drop|alter|truncate|grant|revoke|create)\s' then
    raise exception 'Only SELECT statements are allowed';
  end if;

  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', query) into result;
  return result;
end;
$$;
