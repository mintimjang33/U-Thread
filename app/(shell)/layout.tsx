'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard/insights', label: '트렌드 & 인사이트' },
  { href: '/dashboard/benchmark', label: '벤치마킹 보관함' },
  { href: '/dashboard/threads-archive', label: '내 게시물 보관함', premium: true },
  { href: '/dashboard/personas', label: '페르소나 관리' },
  { href: '/dashboard/threads-manage', label: '내 쓰레드 관리' },
  { href: '/dashboard/videos', label: '유쓰레드 아카이브', premium: true },
  { href: '/dashboard/revenue', label: '수익 인증 라운지' },
];

const BYOK_ITEMS = [
  { key: 'ai', label: 'AI API 연결', href: '/onboarding', provider: 'GEMINI' as const },
  { key: 'threads', label: 'THREADS 계정 연결', href: '/dashboard/threads-manage', provider: null },
  { key: 'coupang', label: '쿠팡 파트너스 API', href: '/onboarding/coupang', provider: 'COUPANG' as const },
  { key: 'toss', label: '토스 API', href: '/onboarding/toss', provider: 'TOSS' as const },
];

const HELP_ITEMS = [
  {
    key: 'gemini',
    label: 'Gemini 연동 안내',
    href: '/onboarding',
    steps: [
      'Google AI Studio(aistudio.google.com)에 접속해서 구글 계정으로 로그인해요.',
      '좌측 메뉴에서 "Get API key" → "Create API key"를 클릭해요.',
      '발급된 키를 복사해요.',
      '유쓰레드의 "AI API 연결" 페이지에 붙여넣고 저장하면 끝이에요.',
    ],
  },
  {
    key: 'threads',
    label: 'Threads 계정 연결 안내',
    href: '/dashboard/threads-manage',
    steps: [
      '"내 쓰레드 관리" 메뉴에서 "THREADS 계정 연동하기" 버튼을 눌러요.',
      'Meta(Threads) 로그인 화면이 뜨면 본인 Threads 계정으로 로그인해요.',
      '권한 요청 화면에서 내용을 확인하고 "계속"을 눌러요.',
      '자동으로 유쓰레드로 돌아오면 연동이 완료된 거예요.',
    ],
  },
  {
    key: 'coupang',
    label: '쿠팡 파트너스 연동 안내',
    href: '/onboarding/coupang',
    steps: [
      '쿠팡파트너스(partners.coupang.com)에 가입하고 로그인해요.',
      '마이페이지 → "Open API 키 발급" 메뉴로 들어가요.',
      'Access Key / Secret Key를 확인해요.',
      '유쓰레드의 "쿠팡 파트너스 API" 페이지에 두 값을 입력하고 저장하면 끝이에요.',
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpDetail, setHelpDetail] = useState<(typeof HELP_ITEMS)[number] | null>(null);

  useEffect(() => {
    Promise.all([
      ...BYOK_ITEMS.filter((b) => b.provider).map((b) =>
        fetch(`/api/keys?provider=${b.provider}`)
          .then((r) => r.json())
          .then((d) => [b.key, !!d.hasKey] as const)
      ),
      fetch('/api/threads-accounts')
        .then((r) => r.json())
        .then((d) => ['threads', !!d.accounts?.length] as const)
        .catch(() => ['threads', false] as const),
    ]).then((entries) => setConnected(Object.fromEntries(entries)));

    fetch('/api/subscription')
      .then((r) => r.json())
      .then((d) => setIsSubscribed(!!d.isSubscribed))
      .catch(() => {});

    fetch('/api/admin/check')
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.isAdmin))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-white text-black">
      <aside className="w-64 border-r border-border flex flex-col">
        <Link href="/" className="block px-6 py-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center font-black text-xs">U</div>
            <span className="font-black tracking-tight">유쓰레드</span>
          </div>
          <div className="text-[10px] text-neutral-400 font-bold pl-8">스마트 에디터 허브</div>
        </Link>

        <div className="px-4 space-y-2 mb-4">
          <Link href="/write" className="block text-center bg-accent hover:bg-accent-hover text-white text-[11px] font-black py-3.5 rounded-card-sm transition-colors">
            + 스마트 에디터 작성
          </Link>
          <Link href="/multi-write" className="block text-center bg-zinc-800 hover:bg-zinc-900 text-white text-[11px] font-black py-3.5 rounded-card-sm transition-colors">
            ⚡ 멀티 에디터 작성
          </Link>
        </div>

        <nav className="flex-1 px-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 text-[11px] font-black rounded-card-sm ${
                  active ? 'bg-accent-soft text-accent' : 'text-neutral-500 hover:text-black'
                }`}
              >
                {item.label}
                {item.premium && <span className="text-[9px] text-neutral-300">🔒</span>}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center justify-between px-4 py-3 text-[11px] font-black rounded-card-sm ${
                pathname === '/admin' ? 'bg-accent-soft text-accent' : 'text-neutral-500 hover:text-black'
              }`}
            >
              🛠 관리자
            </Link>
          )}
        </nav>

        <div className="px-4 pt-3 relative">
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="w-full bg-violet-100 text-violet-700 text-[10px] font-black px-3 py-1.5 rounded-full"
          >
            API 연동이 힘드신가요?
          </button>
          {showHelp && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowHelp(false)} />
              <div className="absolute bottom-full left-4 mb-2 w-56 bg-white border border-border shadow-lg z-50 p-2 rounded-card-sm">
                <div className="text-[10px] font-black text-neutral-400 px-2 py-1">연동 가이드 보기</div>
                {HELP_ITEMS.map((h) => (
                  <button
                    key={h.key}
                    onClick={() => {
                      setHelpDetail(h);
                      setShowHelp(false);
                    }}
                    className="w-full text-left flex items-center gap-2 px-2 py-2 text-[11px] font-bold hover:bg-neutral-50"
                  >
                    📖 {h.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border space-y-2">
          {BYOK_ITEMS.map((b) => {
            const isConnected = !!connected[b.key];
            return (
              <Link key={b.key} href={b.href} className="flex items-center justify-between text-[11px]">
                <span>{b.label}</span>
                {isConnected ? (
                  <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" /> 연동됨
                  </span>
                ) : (
                  <span className="text-red-500 text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> 미연동 상태 →
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="px-4 py-4 border-t border-border flex items-center justify-between">
          <Link href="/mypage" className="text-[10px] text-neutral-400">
            마이페이지 관리 →
          </Link>
          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-pill">프리미엄</span>
            ) : (
              <Link href="/purchase" className="bg-accent hover:bg-accent-hover text-white text-[10px] font-black px-2.5 py-1.5 rounded-pill transition-colors">구독</Link>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 p-10 flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border mt-16 pt-6 text-center text-[11px] text-neutral-400">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Link href="/policy#terms" className="hover:text-black">이용약관</Link>
            <span>·</span>
            <Link href="/policy#privacy" className="hover:text-black">개인정보처리방침</Link>
            <span>·</span>
            <Link href="/policy#support" className="hover:text-black">도움말 및 지원</Link>
            <span>·</span>
            <Link href="/policy#status" className="hover:text-black">API 상태</Link>
          </div>
          <div>© 2026 유쓰레드. All rights reserved.</div>
        </footer>
      </main>

      {helpDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setHelpDetail(null)}>
          <div className="bg-white p-8 max-w-sm w-full rounded-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">📖 {helpDetail.label}</h2>
            <ol className="space-y-3 mb-6">
              {helpDetail.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-xs leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <button onClick={() => setHelpDetail(null)} className="flex-1 border border-border text-[11px] font-black py-3 rounded-card-sm">닫기</button>
              <Link
                href={helpDetail.href}
                onClick={() => setHelpDetail(null)}
                className="flex-1 text-center bg-accent hover:bg-accent-hover text-white text-[11px] font-black py-3 rounded-card-sm transition-colors"
              >
                연동하러 가기
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
