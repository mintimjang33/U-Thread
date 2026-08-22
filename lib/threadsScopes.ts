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
  { key: 'threads_profile_discovery', label: '공개 프로필 조회' },
] as const;

// threads_profile_discovery는 scope에는 포함하지만 실제 기능(롤모델 계정 검색)에선 안 쓴다.
// 공식 문서 기준 앱 심사 전 표준 액세스로는 @meta/@threads/@instagram/@facebook 등
// 일부 공식 계정만 조회 가능해서, 임의의 공개 계정을 스크래핑하는 기존 방식이 더 실용적이다.

export const THREADS_SCOPE_STRING = THREADS_SCOPES.map((s) => s.key).join(',');
