'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// 프리미엄 게이팅. 실제 구독 상태(ut_subscriptions)를 확인해서, 구독 중이면 children을
// 그대로 보여주고 아니면 잠금 카드를 보여준다. 구독 확인 전(로딩 중)에는 아무것도 안 보여준다.
export function PremiumGate({ message, children }: { message: string; children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'locked' | 'unlocked'>('loading');

  useEffect(() => {
    fetch('/api/subscription')
      .then((r) => r.json())
      .then((d) => setStatus(d.isSubscribed ? 'unlocked' : 'locked'))
      .catch(() => setStatus('locked'));
  }, []);

  if (status === 'loading') return null;
  if (status === 'unlocked') return <>{children}</>;

  return (
    <div className="border border-border bg-neutral-50 p-10 text-center max-w-lg mx-auto mt-10">
      <div className="text-3xl mb-4">🔒</div>
      <p className="text-sm text-neutral-600 leading-relaxed mb-6">{message}</p>
      <Link href="/purchase" className="inline-block bg-accent text-white text-[11px] font-black px-6 py-3">
        프리미엄 구독하기
      </Link>
    </div>
  );
}
