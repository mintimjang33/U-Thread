# DREATHS(THREADMATE) 클론 프로젝트 계획서

> 이 문서는 **기억(메모리)이 없는 새로운 Claude 세션이 읽어도 이 프로젝트를 처음부터 이어서 진행할 수 있도록** 자기완결적으로 작성되었습니다.
> 작성일: 2026-08-18 (사용자 요청으로 크롬(로그인 상태)에서 원본 사이트를 직접 정찰하여 작성)
> 작업 디렉토리: `C:\Users\NeoSol\Downloads\dreaths-clone\`

---

## 0. 이 문서를 읽는 새 Claude 세션을 위한 요약

- 사용자(주인님)는 `https://drt.agczero.com/` 이라는 실제 서비스 중인 SaaS를 **풀스택으로 클론**하고 싶어합니다. "우선 클론 → 이후 업그레이드"가 목표입니다.
- 사용자는 기술 스택에 대한 선호가 없으며 ("기술스택은 잘 모르겠고"), Claude가 알아서 정하면 됩니다.
- 사용자는 원본 사이트에 **실제 로그인된 계정**을 가지고 있었고, Claude가 크롬(mcp__claude-in-chrome)으로 직접 로그인 상태 대시보드를 정찰했습니다. 이 문서의 §2가 그 정찰 결과 전체입니다.
- **아직 프리미엄(유료) 결제는 하지 않았습니다.** 프리미엄 전용 화면(스마트 에디터 실제 동작, 페르소나 관리 실제 동작, 내 게시물 보관함, DREATHS 아카이브)은 잠금 화면만 확인했고 내부 실동작은 못 봤습니다. 필요하면 사용자에게 재확인 후 진행.
- 정찰 완료를 위해 **사용자 승인 하에 원본 사이트에서 실제 로그아웃**했습니다(2026-08-18). 이후 랜딩페이지 전체와 로그인/회원가입 폼까지 마저 확인했습니다(§2.1a, §2.3①). **브라우저에는 현재 로그아웃 상태로 남아있으므로, 원본 사이트 재정찰이 필요하면 사용자가 다시 로그인해야 합니다.**
- **다음 실행 단계는 §5(로드맵) Phase 1부터** 입니다. 아직 코드는 한 줄도 작성되지 않았습니다 (이 PLAN.md만 존재).
- 클론이지만 **원본 브랜드(서비스명 "THREADMATE", 회사명 "Awesome God Corporation", 로고, 도메인 agczero.com)를 그대로 사용하면 안 됩니다.** 상표/저작권 문제 소지가 있으므로 새 이름·로고로 리브랜딩해서 진행하는 것을 전제로 합니다. (§6 참고)

---

## 1. 원본 서비스 개요

| 항목 | 내용 |
|---|---|
| 접속 URL | `https://drt.agczero.com/` |
| 서비스 실제 이름 (푸터에서 확인) | **THREADMATE** |
| 운영사 (푸터에서 확인) | Awesome God Corporation |
| 표면 브랜드명 (헤더 로고) | DREATHS |
| 카테고리 | 쓰레드(Meta Threads) 콘텐츠 자동화 + 퍼스널 브랜딩 + 수익화 SaaS |
| 핵심 가치 제안 (랜딩 카피) | "퍼스널 브랜딩과 수익화를 동시에 달성하세요 — 기계적인 AI 글쓰기에 시간을 낭비하지 마세요. 알고리즘 페널티 없이 영향력을 극대화하는 프리미엄 콘텐츠 오케스트레이션" |
| 요금제 | 30일 프리미엄: **월 33,000원** (정가 99,000원, 67% 할인) / 365일 프리미엄: **연 297,000원** |
| 고객상담 | Channel.io(채널톡) 위젯 임베드 |

---

## 2. 정찰 결과 상세 (사이트맵 + 기능별 상세)

### 2.1 전체 사이트맵

```
/ (랜딩, 비로그인시)                → 로그인 상태면 /dashboard/insights 로 자동 리다이렉트
/onboarding                         → Gemini API 키 등록 화면 (BYOK Vault)
/onboarding/coupang                 → 쿠팡파트너스 API 키 등록 화면 (BYOK Vault)
/onboarding/toss                    → 토스쇼핑 파트너스 API 키 등록 화면 (BYOK Vault)
/api/auth/threads/callback          → Threads OAuth 콜백 (Meta Threads 실제 로그인으로 리다이렉트됨)
/auth/login                         → 로그인 (자체 아이디/비번 인증, 소셜로그인 없음)
/auth/signup                        → 회원가입
/mypage                             → 마이페이지 (계정정보 수정, 보안/API키 섹션은 프리미엄 잠김, 전체 세션 로그아웃)
/purchaseMonth/dreath-m-30          → 프리미엄 구독 결제 페이지
/write                              → 스마트 에디터 (AI 글쓰기) — 프리미엄 잠금
/dashboard/insights                 → 트렌드 & 인사이트 (부분 무료)
/dashboard/benchmark                → 벤치마킹 보관함 (무료)
/dashboard/threads                  → 내 게시물 보관함 — 프리미엄 잠금
/dashboard/personas                 → 페르소나 관리 — 프리미엄 잠금
/dashboard/threads-manage           → 내 쓰레드 관리 → 클릭 즉시 Threads(Meta) 실제 OAuth로 리다이렉트
/dashboard/videos                   → DREATHS 아카이브 (숏폼 비디오 소재) — 프리미엄 잠금
/dashboard/revenue                  → 수익 인증 라운지 (무료, 커뮤니티 게시판)
/dashboard/revenue/write            → 수익 인증글 작성 폼 (무료)
```

(추가 정찰 완료: 사용자 승인 하에 실제로 로그아웃하여 §2.1a 로그인/회원가입 폼과 §2.3 ① 랜딩페이지 전체를 마저 확인했습니다. 로그아웃 후에는 재로그인이 필요합니다.)

### 2.1a 로그인 / 회원가입 폼 상세

**로그인 (`/auth/login`)**
- 필드: `AUTH ID`(아이디) / `PASSWORD`(비밀번호) — 이메일이 아닌 자체 아이디 체계, 소셜로그인 없음
- 버튼: "시스템 접속 (LOGIN)"
- 하단: 아이디 찾기 | 비밀번호 찾기 / "회원가입 (SIGN UP)" 링크
- 폼 하단 고정 문구: **"SECURED BY THREADMATE VAULT"** (서비스 실제 이름 THREADMATE 재확인)

**회원가입 (`/auth/signup`)**
- 헤드카피: "DReaThs와 함께 스마트한 오케스트레이션을 시작하세요"
- 필드(전부 2열 그리드): 아이디\* / 이름\*(담당자명) / 이메일\*(placeholder `admin@dreaths.com`) / 전화번호\*(하이픈 없이 숫자만) / 회사명\*(없으면 이름 입력 가능) / 비밀번호\* / 비밀번호 확인\* / 추천인 ID(선택)
- 웹사이트 이용약관 동의 체크박스(필수) → [회원가입 완료 →]
- 하단: "이미 계정이 있으신가요? 로그인" / "안전한 보안 환경에서 보호됩니다"
- 온보딩 가이드 위젯이 유튜브 튜토리얼 영상("[드레스 사용법] EP.1 | 회원가입", 채널명 "개발의 신")을 자동 재생 — 원본 제작자가 직접 만든 유튜브 사용법 시리즈로 추정. 클론에는 직접 불필요.

### 2.2 대시보드 좌측 네비게이션 구조

```
[+ 스마트 에디터 작성]  ← 상단 고정 CTA 버튼

트렌드 & 인사이트        (부분무료)
벤치마킹 보관함          (무료)
내 게시물 보관함         (프리미엄)
페르소나 관리            (프리미엄)
내 쓰레드 관리           (Threads OAuth 연동, 실제 로그인 필요)
DREATHS 아카이브        (프리미엄)
수익 인증 라운지         (무료)

--- 하단 고정 영역 ---
[아이콘 4개, 각각 BYOK 연동 상태 점(빨간 점=미연동)]
  1) ✨ AI API 연동      → /onboarding          (Google Gemini API 키)
  2) @  THREADS 계정 연동 → 실제 threads.com OAuth
  3) 📦 쿠팡 파트너스 API → /onboarding/coupang  (Access Key + Secret Key)
  4) 🛍️ 토스 API(토스쇼핑) → /onboarding/toss     (Access Key + Secret Key + 회원연동ID/PublisherID UUID)

마이페이지 관리 → [사용자명 / 회사명 표시] [구독 버튼] [로그아웃 아이콘]
```

### 2.3 페이지별 상세

#### ① 랜딩 페이지 (`/`, 비로그인) — 전체 스크롤 완료

다크 테마, 상단 헤더 고정: 로고 "DREATHS" + 우측 LOGIN 버튼. 섹션 순서(위→아래):

1. **온보딩 웰컴 모달** (첫 진입시): "드레스에 오신 것을 환영합니다! 드레스 사용 방법을 안내해 드릴까요? 영상을 보며 쉽게 따라하실 수 있습니다." [다음에 보기] / [사용법 보기]
2. **히어로**: "퍼스널 브랜딩과 수익화를 동시에 달성하세요." + "기계적인 AI 글쓰기에 시간을 낭비하지 마세요. DReaThs는 알고리즘 페널티 없이 당신의 영향력을 극대화하는 가장 완벽한 프리미엄 콘텐츠 오케스트레이션입니다." + [DREATHS 시작하기] CTA
3. **Pain Point #1 — 자동화의 함정**: "90%의 자동화 툴 유저가 겪는 현실 — 매일 수십 개의 글을 예약 발행하고 올리지만 노출도는 점점 떨어지고, 결국 당신의 계정이 '섀도우 밴(Shadow Ban)' 처리되어 그동안의 노력이 물거품이 됩니다."
4. **Pain Point #2 — AI 티 나는 콘텐츠**: "누가 봐도 챗GPT가 복사해 붙인 듯한 전형적인 글을 적으시나요? 사람들은 1초 만에 AI임을 감별해 내고 피드를 이탈합니다. 진짜 '나'의 톤앤매너를 흉내내는 툴은 없었습니다." (배경 mockup: "ALGORITHM WARNING: User Bounce Rate Detected: 98.4% / Action: Penalty Applied to Profile")
5. **Pain Point #3 — API 키 보안/원가 문제**: "API 원가 통제 불가와 보안 취약성 — 출처를 알 수 없는 구글 확장 프로그램이나 복잡한 파이썬 스크립트에 당신의 고유 Gemini API 키를 저장하는 것은 집 비밀번호를 길거리에 적어두는 것과 같습니다." (배경 mockup: "Gemini API Key: Exposed" / "Monthly Tool Cost: 142,500원") → **이 pain point가 §2.3 ⑫ BYOK Vault(AES-256 암호화) 기능의 마케팅 근거**
6. **솔루션 섹션**: "이 악순환을 끊어낼 거대한 해결책 — DReaThs만이 가진 압도적인 생성AI 기술의 격차를 확인하세요." 3열 Core Technology 카드:
   - CORE TECH 1: 스마트 에디터 & 제휴 마케팅 — "쿠팡 파트너스 API 연동으로 클릭 한 번에 제휴 링크 자동 생성"
   - CORE TECH 2: 데이터랩 & 실시간 트렌드 — "실시간 검색어, 구글 트렌드, 쇼핑 트렌드 데이터 자동 수집"
   - CORE TECH 3: 스레드 아카이브 & 벤치마킹 — "작성한 모든 스레드 원본과 통계를 영구적으로 아카이브 보관"
7. **통계 강조 섹션** (숫자 카운터 애니메이션 추정): `0%` Algorithm Penalty / `2.5x` Reach Engagement / `100%` Data Isolation / `(무한대 기호 추정)` Persona Scalability
8. **최종 CTA**: "가장 진보된 형태의 파이프라인, 이제 당신이 직접 증명해 보세요." + "단순히 영혼 없는 글을 찍어내는 낡은 방식에서 탈피하세요. DReaThs는 팔로워의 신뢰를 무너뜨리지 않으면서도, 당신의 수익화 목표를 가장 기술적이고 정교하게 달성해 냅니다." + [DREATHS 시작하기]
9. **푸터**: "Copyright © 2026 DReaThs. All rights reserved." + 태그라인 **"ZERO-TRUST AI CONTENT ORCHESTRATION PLATFORM"**

→ 랜딩페이지의 설득 구조는 **"3가지 Pain Point(섀도우밴 / AI티 나는 글 / API키 보안·원가) → 3가지 Core Technology 솔루션 → 신뢰 통계 → CTA"** 순서로 명확한 PAS(Problem-Agitate-Solve) 카피라이팅 패턴을 따릅니다. 클론의 랜딩페이지도 이 구조를 그대로 재현하되 카피는 리브랜딩합니다.

#### ② 트렌드 & 인사이트 (`/dashboard/insights`)
- 상단: "스레드 인기 글 검색" 입력창(예시 플레이스홀더: "마케팅, AI") + 검색 버튼 + "최근 데이터 동기화 완료: [날짜시간]" 표시 + "실시간 데이터 재동기화" 버튼
- 탭 4개: **데이터랩(무료)** / 구글 트렌드(프리미엄) / 쇼핑 트렌드(프리미엄) / 실시간 뉴스(프리미엄)
- 데이터랩 탭: 카테고리 칩 12개 (패션의류/패션잡화/화장품·미용/디지털가전/가구·인테리어/출산육아/식품/스포츠레저/생활건강/여가생활편의/도서) 선택시 해당 카테고리 "TOP 500" 키워드 랭킹 카드 목록 (순위번호+키워드명, 2열 그리드)
- 프리미엄 탭 클릭시 모달: "프리미엄 구독이 필요합니다 — 실시간 뉴스, 구글/쇼핑 트렌드, 숏텐츠 분석 기능은 프리미엄 회원 전용입니다." + 요금제 2종 카드 + [나중에 구독할게요]

#### ③ 벤치마킹 보관함 (`/dashboard/benchmark`, 무료)
- 상단: "원작자 ID 또는 내용 검색..." 입력창 + [익스텐션(크롬) 키 연동] 버튼 + [+ 수동으로 텍스트 복붙하기] 버튼
- 빈 상태 문구: "[ 보관함 비어있음 / 익스텐션 우클릭으로 스크래핑을 실행하세요 ]"
- **"수동으로 텍스트 복붙하기" 모달**: 작성자/출처(선택, placeholder "예: 쓰레드 @insight_kr") + 본문 내용(필수, textarea) + [취소]/[보관함에 저장]
- → 벤치마킹용 콘텐츠는 (1) 별도 크롬 익스텐션으로 자동 스크래핑, (2) 수동 붙여넣기 두 가지 경로로 수집되는 구조

#### ④ 내 게시물 보관함 (`/dashboard/threads`, 프리미엄 잠금)
- 잠금 카드: "스마트 에디터로 작성하고 생성된 모든 브랜드 피드 및 타래 보관 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다."

#### ⑤ 페르소나 관리 (`/dashboard/personas`, 프리미엄 잠금)
- 잠금 카드: "나만의 고유한 말투, 타겟팅 프롬프트, AI 페르소나 설정 및 프로필 분석 추출 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다."

#### ⑥ 내 쓰레드 관리 (`/dashboard/threads-manage`)
- 클릭 즉시 실제 `https://www.threads.com/login?next=...oauth/authorize?client_id=1532745488484389&redirect_uri=https://drt.agczero.com/api/auth/threads/callback&scope=threads_basic,threads_content_publish,threads_keyword_search,threads_manage_insights,threads_manage_mentions,threads_manage_replies,threads_profile_discovery,threads_read_replies,threads_delete,threads_share_to_instagram&response_type=code`
- → **Meta Threads API 공식 OAuth 플로우**를 그대로 사용. scope 목록이 매우 상세함 (읽기/쓰기/댓글/멘션/인사이트/삭제/인스타공유 등 거의 풀 권한)
- ⚠️ Claude는 여기서 실제 로그인(자격증명 입력)을 하지 않았음 — 계정 자격증명 프롬프트 등장시 절대 입력 금지 규칙 준수

#### ⑦ DREATHS 아카이브 (`/dashboard/videos`, 프리미엄 잠금)
- 잠금 카드: "고화질 원본 숏폼 비디오 소재 아카이브 전체 열람 및 다운로드 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다."

#### ⑧ 수익 인증 라운지 (`/dashboard/revenue`, 무료)
- 커뮤니티 게시판. 카드형 레이아웃, 각 카드: 작성자 마스킹 닉네임(예 "김**님") + 수익 인증 타이틀 + 금액(₩) + 날짜 + 조회수 + 좋아요 수
- 일부 카드는 실제 쿠팡파트너스 대시보드 스크린샷을 캡처한 형태로 클릭수/구매건수/합산금액/수익/전환율 수치가 이미지 안에 표시됨
- [+ 수익 인증하기] → `/dashboard/revenue/write` 이동

#### ⑨ 수익 인증글 작성 (`/dashboard/revenue/write`, 무료)
- 필드: 제목(필수, text) / 수익 금액(원, 필수, number) / 수익 인증 캡처(선택, 이미지 업로드 PNG·JPG·GIF 최대 5MB, 드래그앤드롭) / 상세 내용(textarea)
- [취소] / [인증 글 등록하기]
- 페이지 최하단 푸터: "이용약관 · 개인정보처리방침 · 도움말 및 지원 · API 상태" + "© 2026 THREADMATE. DESIGNED FOR Awesome God Corporation." + "본 시스템은 허가된 사용자만 접근할 수 있으며, 불법적인 접근 및 스크래핑을 감시 및 추적합니다."

#### ⑩ 마이페이지 (`/mypage`)
- "정보 변경" 섹션: 이름(text) / 회사명(text) / 새 비밀번호 교체 / 새 비밀번호 확인 → [수정 사항 저장하기]
- "보안 및 API 키 (SECURITY)" 섹션 → **프리미엄 잠금**: "스레드 다중 계정 연동 및 Gemini AI API 커스텀 볼트 연동 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다." (= 무료 회원은 계정당 1개 볼트/1개 스레드 계정만 가능한 구조로 추정)
- 하단: [모든 세션 로그아웃]

#### ⑪ 구독 결제 페이지 (`/purchaseMonth/dreath-m-30`)
- "프리미엄 구독 — DREATHS 정기 구독권 결제 신청"
- 선택된 구독 상품 카드: 플랜명(DReaThs 30일 프리미엄 이용권) / 이용기간(30일) / 정가 99,000원 취소선 / 67% OFF / **33,000원(부가세 포함)**
- 안내문: "첫 결제 완료 후 매월 동일한 일자에 자동으로 정기 결제가 진행됩니다. 언제든지 마이페이지에서 구독 해지가 가능합니다."
- 체크박스 2개(필수): 소프트웨어 정기구독 서비스 이용약관 동의 / 청약철회(환불) 제한 조건 동의 (링크로 "필수 확인" 팝업 존재)
- 결제 버튼: "💳 드레쓰 정기 구독" — **실제 결제는 진행하지 않았음.** PG사는 미확인이나 "토스 API" 연동 메뉴가 별도 존재하는 것으로 보아 토스페이먼츠(TossPayments) 정기결제(빌링) API 사용 가능성이 높음

#### ⑫ 온보딩(BYOK Vault) 3종

모두 공통 문구: **"DREATHS 보안 볼트(VAULT) — BYOK 보안 프로토콜이 적용되었습니다. 귀하의 [서비스명] API 키는 데이터베이스에 통합 AES-256 암호화되어 저장됩니다."**

| 경로 | 입력 필드 | 비고 |
|---|---|---|
| `/onboarding` | GOOGLE GEMINI API 키 (placeholder `AIzaSy...`) | AI 글쓰기용, 사용자가 자기 Gemini 키를 직접 발급받아 입력 |
| `/onboarding/coupang` | ACCESS KEY / SECRET KEY | 쿠팡파트너스 오픈API |
| `/onboarding/toss` | ACCESS KEY / SECRET KEY / 회원 연동 ID(PublisherID, UUID 형식) | 토스쇼핑 파트너스 |

→ **이 서비스는 AI 기능도, 제휴마케팅 기능도 전부 "BYOK(Bring Your Own Key)" 구조입니다.** 서비스 운영사가 API 비용을 부담하지 않고, 사용자가 각자 발급받은 키를 AES-256으로 암호화해 저장해두고 서비스가 그 키로 사용자 대신 호출하는 방식. 이건 클론 설계에서 매우 중요한 아키텍처 결정 포인트입니다 (§4 참고).

### 2.4 확인된 API 엔드포인트 (네트워크 탭 + fetch로 직접 확인)

```
GET  /api/keys/status                         → {"hasKey":false,"provider":"GEMINI"}
GET  /api/keys/status?provider=COUPANG
GET  /api/keys/status?provider=TOSS
GET  /api/keys/status?provider=THREADS
GET  /api/subscription/status                  → {"isSubscribed":false,"dreath":"2026-08-17T21:21:57.000Z","remainingDays":0,"hasPaidBilling":false}
GET  /api/trends/datalab                       → {"datalab":[{"categoryName":"도서","keywords":["...","..."]}, ...]}   (카테고리별 인기키워드 배열, 네이버 데이터랩 성격)
GET  /api/trends/google                        (구글 트렌드, 프리미엄)
GET  /api/trends/realtime                      → {"keywords":["뉴스성 실시간 이슈 키워드", ...]}
GET  /api/trends/shopping/categories?type=ISSUE
GET  /api/trends/shortents                     → {"shortents":{"뷰티":[{"id":..,"category":"뷰티","title":"...","summary":"..."}, ...], ...}}
POST /api/auth/threads/callback                (Threads OAuth 콜백)
```

### 2.5 기술 스택 추정 (원본 사이트, 개발자도구로 확인)

- **Next.js (App Router)** — `_next/static/chunks/app/dashboard/insights/page-*.js` 형태의 청크 경로, `main-app-*.js` 존재로 App Router 확정
- 이미지 최적화: Next.js `/_next/image?url=...` 사용
- 폰트: `next/font` 로컬 폰트 서빙 (`.p.ttf` 우선 로드 패턴)
- 고객상담 위젯: Channel.io (`cdn.channel.io`, `api.channel.io`)
- CSS: Next.js 자체 CSS 청크 2개 로드 (Tailwind 여부는 미확정이나 UI 패턴(유틸리티성 클래스 다수 추정)상 Tailwind 가능성 높음)
- AI 프로바이더: **Google Gemini** (BYOK)
- 결제: 토스페이먼츠로 추정 (미확정)

---

## 3. 클론 목표 범위 정의

원본과 100% 동일한 브랜드/서비스명이 아니라, **동일한 기능·정보구조·UX 흐름을 재현하는 클론**을 만듭니다.

**클론에 포함할 핵심 기능 (원본 기준):**
1. 랜딩페이지 + 인증(로그인/회원가입)
2. 대시보드 셸(좌측 사이드바 네비게이션 + 하단 BYOK 연동 상태바)
3. 트렌드 & 인사이트 (데이터랩 무료 탭 + 프리미엄 탭 3종 잠금 UX)
4. 벤치마킹 보관함 (수동 텍스트 저장 — 크롬 익스텐션 연동은 후순위)
5. 수익 인증 라운지 (게시판 CRUD + 이미지 업로드)
6. 마이페이지 (계정정보 수정, 비밀번호 변경, 세션 로그아웃)
7. 구독/결제 페이지 (정기결제 UI, 실제 PG 연동은 Phase 3+)
8. BYOK Vault 3종 (Gemini / 쿠팡파트너스 / 토스쇼핑) — 키 암호화 저장
9. 프리미엄 잠금 UX 패턴 (스마트 에디터, 내 게시물 보관함, 페르소나 관리, DREATHS 아카이브 — 처음엔 잠금 화면만 재현, 실제 기능은 후순위)
10. Threads OAuth 연동 (실제 Meta Threads Developer 앱 등록 필요 — Phase 4)

**클론에서 제외/후순위:**
- 크롬 익스텐션 자체 개발 (벤치마킹 자동 스크래핑용) — Phase 5 업그레이드 대상
- Channel.io 등 실제 3rd party 상담 위젯 — 선택사항
- 원본과 동일한 정확한 카피라이팅/디자인 픽셀 단위 복제 — 톤앤매너만 참고, 리브랜딩

---

## 4. 제안 기술 스택 (Claude 추천, 사용자 확정 필요 없음 — 이대로 진행 예정)

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **Next.js 14+ (App Router) + TypeScript** | 원본과 동일 계열이라 UX/라우팅 구조를 그대로 대응시키기 쉬움. 서버 컴포넌트로 대시보드 셸 구성에 적합 |
| 스타일 | **Tailwind CSS** | 원본 추정 스택과 유사, 빠른 UI 개발 |
| DB/Auth/Storage | **Supabase (Postgres + Auth + Storage)** | 이미지 업로드(수익인증 캡처), Row Level Security로 사용자별 데이터 격리를 한 번에 해결. 프로젝트 초기 무료 티어로 충분 |
| 로그인 방식 | **Google OAuth(기본, 전면 노출) + 이메일/비번(보조)** — Supabase Auth 내장 Google Provider 사용 | 원본은 자체 아이디/비번만 지원(§2.1a)했지만, 사용자 요청으로 접근성·가입전환율 개선을 위해 변경. Google 계정이 없는 소수 사용자를 위해 이메일/비번도 폐기하지 않고 유지 |
| API 키 암호화(BYOK Vault) | Node `crypto` AES-256-GCM, 서버 전용 마스터 키(`.env`)로 암호화 후 Supabase에 저장 | 원본과 동일한 "AES-256 암호화 저장" 문구 그대로 구현 가능 |
| 결제 | **토스페이먼츠 정기결제(빌링) API** | 한국 서비스, 원본이 "토스 API" 메뉴를 갖고 있는 것과 정합적. 자동 정기결제(빌링키) 지원 |
| AI 연동 | **Google Gemini API** (BYOK, 사용자가 자기 키 입력) | 원본과 동일 |
| 외부 트렌드 데이터 | 초기엔 목업 데이터 또는 공개 가능한 소스로 대체 (네이버 데이터랩은 공식 오픈API로 검색어 트렌드 제공 — 카테고리 랭킹은 비공식 스크래핑 영역이라 법적 검토 필요) | §6 참고 |
| Threads 연동 | Meta for Developers에서 신규 앱 등록 후 Threads API OAuth 플로우 재현 | 원본과 동일한 scope 목록 재사용 가능 |
| 배포 | Vercel (Next.js 궁합) + Supabase 클라우드 | — |

---

## 5. 단계별 구현 로드맵

### Phase 1 — 뼈대 (풀스택 MVP 골격)
- [ ] Next.js + TypeScript + Tailwind 프로젝트 초기화 (`dreaths-clone` 디렉토리 내)
- [ ] Supabase 프로젝트 생성, Auth 연동 — **Google OAuth(기본) + 이메일/비번(보조)**, 기본 테이블 스키마 설계
  - `users`(name, company), `posts_benchmark`, `revenue_posts`, `api_keys_vault`(provider, encrypted_key, encrypted_secret), `subscriptions`
  - Google 신규 가입자는 회원가입 폼(§2.1a 필드: 전화번호/회사명/추천인ID)을 로그인 후 1회성 "추가 정보 입력" 단계로 보완 수집 (Google이 이름/이메일은 이미 제공하므로 아이디/비번 필드는 생략)
- [ ] 랜딩 페이지 (리브랜딩된 이름/카피)
- [ ] 로그인/회원가입 페이지 — "Google로 계속하기" 버튼을 최상단에 배치, 구분선 아래 이메일/비번 폼 유지
- [ ] 대시보드 레이아웃 셸: 좌측 사이드바(§2.2 구조 그대로) + 상단 헤더 + 하단 BYOK 연동 상태바

### Phase 2 — 무료 핵심 기능
- [ ] 트렌드 & 인사이트: 데이터랩 탭(카테고리 칩 12개 + TOP N 카드) — 초기엔 시드/목업 데이터
- [ ] 벤치마킹 보관함: 수동 텍스트 붙여넣기 CRUD
- [ ] 수익 인증 라운지: 목록 + 작성(이미지 업로드 포함) + 좋아요
- [ ] 마이페이지: 정보수정, 비번변경, 로그아웃

### Phase 3 — 프리미엄/결제 체계
- [ ] 구독 상태 모델링 (`isSubscribed`, `remainingDays`, `hasPaidBilling` 원본 응답 구조 참고)
- [ ] 프리미엄 잠금 UX 컴포넌트 공통화 (잠금 카드 + "30일 프리미엄 구독" CTA)
- [ ] 토스페이먼츠 정기결제(빌링키) 연동, 구독 결제 페이지 재현
- [ ] 프리미엄 게이팅 적용: 내 게시물 보관함/페르소나 관리/DREATHS 아카이브/트렌드 나머지 3탭

### Phase 4 — 외부 서비스 실연동 (BYOK)
- [ ] BYOK Vault 구현: Gemini / 쿠팡파트너스 / 토스쇼핑 키 등록 + AES-256 암호화 저장
- [ ] Gemini API로 실제 "스마트 에디터" AI 글쓰기 구현
- [ ] Meta Threads Developer 앱 등록 → OAuth 연동 → 실제 게시글 발행/조회 (`내 쓰레드 관리`, `내 게시물 보관함`과 연결)
- [ ] 쿠팡파트너스 API로 실제 상품 링크/수익 데이터 연동 (가능 범위 내)

### Phase 5 — 업그레이드 (사용자가 이후에 원하는 방향, 아직 미정)
- [ ] 크롬 익스텐션 자체 개발 (벤치마킹 자동 스크래핑)
- [ ] 페르소나 관리 AI 로직 고도화
- [ ] 트렌드 데이터 실시간 파이프라인 구축 (합법적 데이터 소스로 대체/보강)
- [ ] 그 외 원본에 없는 차별화 기능 추가 (사용자와 논의 필요)

---

## 6. 리스크 / 주의사항

1. **브랜드/상표**: "THREADMATE", "DREATHS", "Awesome God Corporation", 로고, 도메인은 원본 서비스 고유 자산입니다. 클론 프로젝트는 새 이름으로 리브랜딩해서 진행합니다.
2. **트렌드 데이터 출처**: 원본의 데이터랩/구글트렌드/쇼핑트렌드 데이터가 네이버·구글 등에서 스크래핑된 것인지 공식 API인지는 미확인입니다. 클론에서는 가급적 **공식 오픈API**(네이버 검색어트렌드 오픈API 등) 또는 자체 목업으로 대체하는 것을 권장하며, 비공식 스크래핑 방식은 이용약관 위반 소지가 있어 지양합니다.
3. **Threads OAuth**: 실제 연동을 위해서는 Meta for Developers에 별도 앱을 등록하고 심사받아야 합니다(Phase 4). 그 전까지는 UI만 재현.
4. **결제(PG)**: 실제 정기결제 연동 전까지는 결제 버튼을 목업 처리하고, 실제 카드결제/구독 로직은 Phase 3에서 테스트 모드로만 검증합니다.
5. **개인정보**: 정찰 중 마이페이지에서 사용자 실명/회사명이 노출되었으나, 이 계획서에는 기록하지 않았습니다(민감정보 배제).

---

## 7. 다음 액션 (새 세션이 이어서 할 일)

1. 사용자에게 리브랜딩할 서비스명(가칭)을 확인하거나, 임시 가칭으로 진행 승인을 받는다.
2. `dreaths-clone` 디렉토리에 `git init` 후 Phase 1 착수 여부를 확인한다.
3. Phase 1 작업 시작: Next.js 프로젝트 스캐폴딩 → Supabase 스키마 설계안 제시 → 승인 후 구현.

---
*이 문서는 `C:\Users\NeoSol\Downloads\dreaths-clone\PLAN.md` 에 저장되어 있습니다. 업데이트할 때는 이 파일을 직접 수정하세요.*
