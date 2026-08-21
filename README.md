# 유쓰레드 (dreaths-clone)

쓰레드(Meta Threads) 콘텐츠 자동화 + 트렌드 인사이트 + BYOK 제휴마케팅 SaaS. 실제 서비스 `drt.agczero.com`(THREADMATE/DREATHS)을 정찰해서 만든 클론. 자세한 배경/정찰 결과는 [`PLAN.md`](./PLAN.md) 참고.

## 실행

```bash
npm install
npm run dev   # http://localhost:3200
```

## 지금 상태 (2026-08-21)

Phase 1(뼈대) 완료 — 25개 라우트 전부 빌드 통과. Supabase가 아직 연결 안 돼서 **로그인/DB 저장이 실제로는 동작하지 않음**(대시보드는 API 라우트 메모리 스토어로 임시 동작).

## 다음에 진행하려면 필요한 것

1. **Supabase 프로젝트** (새로 생성, UShort와 별개)
   - 대시보드 → Project Settings → API에서 URL/anon key/service_role key 복사
   - `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`에 채워넣기
   - Authentication → Providers → Google 활성화 (Google Cloud Console에서 OAuth 클라이언트 발급 필요)
2. **Google OAuth 클라이언트** (Google Cloud Console) — 로그인 버튼용
3. **Meta Threads Developer 앱** — `/dashboard/threads-manage` 실연동용 (Phase 4)
4. **네이버 검색어트렌드 오픈API 키** (또는 다른 트렌드 데이터 소스) — `/dashboard/insights` 데이터랩 탭 실데이터용

## 디자인 토큰 (실사이트 정찰로 확인한 실제 값)

- 배경 흰색 고정(다크모드 없음), 폰트 굵기 900 다용, 모서리 거의 각짐(2~14px)
- 선택된 필/탭: `bg-black text-white`, 비선택: `bg-white text-neutral-500 border-neutral-200`
