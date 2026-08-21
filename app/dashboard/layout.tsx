'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard/insights', label: '트렌드 & 인사이트' },
  { href: '/dashboard/benchmark', label: '벤치마킹 보관함' },
  { href: '/dashboard/threads-archive', label: '내 게시물 보관함', premium: true },
  { href: '/dashboard/personas', label: '페르소나 관리', premium: true },
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    Promise.all(
      BYOK_ITEMS.filter((b) => b.provider).map((b) =>
        fetch(`/api/keys?provider=${b.provider}`)
          .then((r) => r.json())
          .then((d) => [b.key, !!d.hasKey] as const)
      )
    ).then((entries) => setConnected(Object.fromEntries(entries)));

    fetch('/api/subscription')
      .then((r) => r.json())
      .then((d) => setIsSubscribed(!!d.isSubscribed))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-white text-black">
      <aside className="w-64 border-r border-border flex flex-col">
        <div className="px-6 py-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-black text-xs">U</div>
            <span className="font-black tracking-tight">유쓰레드</span>
          </div>
          <div className="text-[10px] text-neutral-400 font-bold pl-8">스마트 에디터 허브</div>
        </div>

        <div className="px-4">
          <Link href="/write" className="block text-center bg-black text-white text-[11px] font-black py-3.5 mb-4">
            + 스마트 에디터 작성
          </Link>
        </div>

        <nav className="flex-1 px-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 text-[11px] font-black ${
                  active ? 'bg-active-bg text-black' : 'text-neutral-500 hover:text-black'
                }`}
                style={{ borderRadius: 2.2 }}
              >
                {item.label}
                {item.premium && <span className="text-[9px] text-neutral-300">🔒</span>}
              </Link>
            );
          })}
        </nav>

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
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1.5">프리미엄</span>
            ) : (
              <Link href="/purchase" className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1.5">구독</Link>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 p-10">{children}</main>
    </div>
  );
}
