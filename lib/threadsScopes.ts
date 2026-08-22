// Threads OAuth 요청 scope + 연동 후 권한 상태 확인 화면에서 공유하는 단일 소스.
export const THREADS_SCOPES = [
  { key: 'threads_basic', label: '기본 프로필/게시물 조회' },
  { key: 'threads_content_publish', label: '게시물 발행' },
  { key: 'threads_manage_replies', label: '댓글 관리' },
  { key: 'threads_read_replies', label: '댓글 읽기' },
  { key: 'threads_manage_insights', label: '인사이트 조회' },
  { key: 'threads_keyword_search', label: '키워드 검색' },
  { key: 'threads_delete', label: '게시물 삭제' },
  { key: 'threads_manage_mentions', label: '멘션 관리' },
  { key: 'threads_share_to_instagram', label: '인스타그램 공유' },
] as const;

export const THREADS_SCOPE_STRING = THREADS_SCOPES.map((s) => s.key).join(',');
