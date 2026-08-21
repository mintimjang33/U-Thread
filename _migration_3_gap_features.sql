-- 유쓰레드 3차 마이그레이션 (2026-08-21 갭 발견분)
-- 벤치마킹 폴더/링크스크랩, 페르소나 시스템템플릿+제휴댓글템플릿, 글양식 기본설정
-- Supabase SQL Editor에서 실행하세요.

-- === 1. 벤치마킹 폴더 ===
create table if not exists ut_benchmark_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table ut_benchmark_folders enable row level security;

alter table ut_benchmark_items add column if not exists folder_id uuid references ut_benchmark_folders(id) on delete set null;
alter table ut_benchmark_items add column if not exists media_url text;

-- === 2. 시스템 기본 페르소나 (5종, 원본 실제 프롬프트 그대로) ===
create table if not exists ut_system_personas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  prompt text not null,
  sort_order int not null default 0
);

insert into ut_system_personas (name, prompt, sort_order) values
('현실 부부 일상/유머 (Hey Mongle 스타일)',
 '- 친근하고 장난기 가득한 대화체 반말(~했거든?, ~임, ~거야, ㅋㅋㅋ)을 사용해라. - 부부 일상, 소소한 복수, 육아 등 누구나 공감할 수 있는 현실 밀착형 소재를 다뤄라. - 문장 중간중간 ''ㅋㅋㅋ'', '';;;'', ''ㅠㅠ'', ''아오'' 같은 리얼한 온라인 메신저 감탄사를 적극 섞어라. - 결말은 항상 예상치 못한 웃음 포인트나 억울한 하소연(예: 등짝 스매싱)으로 유쾌하게 마무리해라. - 문장은 2~3줄 내외로 짧게 끊어서 가독성을 높여라.',
 1),
('호들갑 꿀템/리얼 찐리뷰어 (다이소/코스트코 스타일)',
 '- 극적인 호들갑과 흥분 섞인 어투(~도랐음;;, ~사고쳤다, 미친 듯이 ~함)를 사용해라. - "이거 모르면 평생 손해", "제발 단종시키지 마세요" 같은 강력한 바이럴 멘트를 서두에 배치해라. - 직접 써보고 감탄한 내돈내산 찐후기 느낌으로 장단점을 직관적이고 생생하게 묘사해라. - 느낌표(!)와 물음표(?)를 풍부하게 쓰고 감정이 그대로 전달되도록 작성해라.',
 2),
('스토리텔링/웹소설형 후킹 에세이',
 '- 첫 문장부터 강렬한 반전이나 호기심을 유발하는 드라마틱한 첫 줄로 시작해라. - "내가 3년 전으로 돌아간다면 절대 하지 않을 선택", "그날 이후 내 통장 잔고는 완전히 바뀌었다" 등 긴장감 있는 서사 구조. - 기승전결이 뚜렷하며, 읽는 사람이 다음 문장을 읽지 않고는 못 배기도록 호흡을 조절해라. - 감성적이고 몰입감 있는 1인칭 독백체(~했다, ~했던 것이다)를 사용해라.',
 3),
('인사이트/팩트 요약형 전문가 (지식/트렌드 큐레이터)',
 '- 군더더기 없는 명확하고 신뢰감 있는 정보 전달형 어조(~함, ~기 때문, ~임)를 사용해라. - 핵심 포인트를 1, 2, 3 번호 매기기나 불릿 기호(•, -)로 구조화하여 3초 만에 훑어볼 수 있게 정리해라. - 통계, 비교 수치, 구체적인 팁을 제시하여 전문성과 유익함을 극대화해라.',
 4),
('공감 100% 힐링/위로형 감성 톤',
 '- 오늘 하루 지친 사람들의 마음을 따뜻하게 안아주는 부드러운 구어체 존댓말(~해요, ~했나요?) 또는 따뜻한 반말을 사용해라. - 일상의 사소한 행복, 온기, 위로가 되는 문장들로 마음을 몽글몽글하게 만들어라. - 과하지 않은 잔잔한 이모지(☕, 🌿, 🌙)를 활용해라.',
 5)
on conflict (name) do nothing;

-- === 3. 제휴 댓글 템플릿 (사용자 커스텀) + 시스템 기본 4종 ===
create table if not exists ut_affiliate_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  body text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
alter table ut_affiliate_templates enable row level security;

insert into ut_affiliate_templates (user_id, name, body, is_system) values
(null, '친근/자연스러움', '너무 많이 물어봐서 아래 링크 달게', true),
(null, '직관적 안내', '이 제품 이 궁금하면 아래 링크 확인해', true),
(null, '강력 추천/전환', '[제품명]은 꼭 구매를 추천해', true),
(null, '정보 큐레이션', '정보 궁금하신 분들은 아래 링크 참고해봐! 👇', true)
on conflict do nothing;

-- === 4. 글양식 기본 설정 (마이페이지 "글양식 설정" 탭) ===
create table if not exists ut_editor_defaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vision_analysis boolean not null default true,
  google_search boolean not null default true,
  thread_segments int not null default 1,
  relay_delay boolean not null default false,
  default_persona_id uuid,
  default_persona_is_system boolean not null default true,
  default_affiliate_template_id uuid,
  coupang_auto_image boolean not null default true,
  toss_auto_image boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table ut_editor_defaults enable row level security;

-- 확인용:
-- select table_name from information_schema.tables where table_schema='public'
--   and table_name in ('ut_benchmark_folders','ut_system_personas','ut_affiliate_templates','ut_editor_defaults');
-- select name from ut_system_personas order by sort_order;
-- select name, body, is_system from ut_affiliate_templates where is_system;
