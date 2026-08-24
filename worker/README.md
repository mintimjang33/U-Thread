# 유쓰레드 로컬 워커 (v1)

사용자 PC에서 도는 상시 실행 프로그램. 두 가지를 사용자의 "이미 로그인된 세션"으로 대신 처리해서, 클라우드 API 종량과금 없이(=클로드 정액 구독 안에서) 글 생성 + 벤치마킹 자동수집을 한다.

- `generate` 작업: 로컬에 설치된 Claude Code CLI(`claude -p "..."`)를 헤드리스로 호출해 텍스트를 생성한다. Gemini API처럼 토큰당 과금되지 않고, 이미 내고 있는 클로드 구독 안에서 처리된다.
- `collect_benchmark` 작업: 로컬 크롬을 CDP로 띄워 threads.net에 로그인된 세션으로 검색·스크롤하며 반응 좋은 글을 수집해 `ut_benchmark_items`에 쌓는다.

## 검증 상태 (2026-08-24)

- ✅ `claude -p` 헤드리스 호출 자체는 이 PC에서 실제로 동작 확인함(별도 인증 필요).
- ✅ puppeteer-core로 실제 크롬을 CDP 원격디버깅 포트로 띄우고 페이지 이동/DOM 읽기까지 실제로 확인함(Gemini 페이지 대상).
- ⚠️ `collectBenchmark.js`의 threads.net 셀렉터(피드 글 요소, 좋아요 버튼 등)는 **실제 로그인된 쓰레드 세션으로 검증하지 못했다** — 내가 쓰레드 계정에 로그인할 수 없기 때문. 최초 실행 시 반드시 사용자가 직접 눈으로 보면서(headless: false) 셀렉터가 맞게 동작하는지 확인 필요. 구조가 바뀌었으면 `collectBenchmark.js` 안의 `SELECTORS`만 고치면 된다.

## 실행 방법

```bash
cd worker
npm install
node pair.js          # 최초 1회: 웹에서 발급받은 페어링 토큰을 로컬에 저장
node index.js          # 상시 폴링 시작
```

## 요구사항

- Node.js
- 로컬에 Chrome 설치
- `npm install -g @anthropic-ai/claude-code` 후 `claude` 로그인 완료(클로드 구독)
