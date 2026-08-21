'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PLANS = {
  monthly: { label: '30일 프리미엄 이용권', period: '30일', original: 99000, price: 33000, discount: '67% OFF' },
  yearly: { label: '365일 프리미엄 이용권', period: '365일', original: 396000, price: 297000, discount: '25% OFF' },
} as const;

export default function PurchasePage() {
  const router = useRouter();
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [loading, setLoading] = useState(false);

  // TODO: 토스페이먼츠 정기결제(빌링키) API 연동 전까지는, 실제 카드 결제 없이
  // 프리미엄 기능을 테스트해볼 수 있도록 구독 상태만 부여한다.
  async function handlePay() {
    if (!agree1 || !agree2) {
      alert('약관에 모두 동의해주세요.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error('구독 처리에 실패했어요.');
      alert(`프리미엄이 활성화됐어요! (실제 결제 없이 테스트용으로 ${PLANS[plan].period} 부여됨)`);
      router.push('/dashboard');
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const selected = PLANS[plan];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full mb-3">
        <Link href="/dashboard" className="text-xs text-neutral-400 hover:text-black">← 대시보드로 돌아가기</Link>
      </div>
      <div className="bg-white border border-border p-8 max-w-sm w-full">
        <h1 className="font-black text-lg mb-1">프리미엄 구독</h1>
        <p className="text-xs text-neutral-400 mb-6">유쓰레드 정기 구독권 결제 신청</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setPlan('monthly')}
            className={`flex-1 border text-xs font-black py-2.5 ${plan === 'monthly' ? 'border-black bg-neutral-50' : 'border-border text-neutral-400'}`}
          >
            30일 플랜
          </button>
          <button
            onClick={() => setPlan('yearly')}
            className={`flex-1 border text-xs font-black py-2.5 ${plan === 'yearly' ? 'border-black bg-neutral-50' : 'border-border text-neutral-400'}`}
          >
            365일 플랜
          </button>
        </div>

        <div className="border border-border p-5 mb-6">
          <div className="text-sm font-black mb-1">유쓰레드 {selected.label}</div>
          <div className="text-xs text-neutral-400 mb-3">이용기간: {selected.period}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-neutral-300 line-through">{selected.original.toLocaleString()}원</span>
            <span className="text-xs font-black text-red-500">{selected.discount}</span>
          </div>
          <div className="text-2xl font-black">{selected.price.toLocaleString()}원 <span className="text-xs font-normal text-neutral-400">(부가세 포함)</span></div>
        </div>

        <p className="text-[11px] text-neutral-400 mb-4 leading-relaxed">
          첫 결제 완료 후 매{plan === 'yearly' ? '년' : '월'} 동일한 일자에 자동으로 정기 결제가 진행됩니다. 언제든지 마이페이지에서 구독 해지가 가능합니다.
        </p>

        <label className="flex items-center gap-2 text-xs mb-2">
          <input type="checkbox" checked={agree1} onChange={(e) => setAgree1(e.target.checked)} />
          소프트웨어 정기구독 서비스 이용약관 동의 (필수)
        </label>
        <label className="flex items-center gap-2 text-xs mb-6">
          <input type="checkbox" checked={agree2} onChange={(e) => setAgree2(e.target.checked)} />
          청약철회(환불) 제한 조건 동의 (필수)
        </label>

        <button onClick={handlePay} disabled={loading} className="w-full bg-black text-white text-[11px] font-black py-4">
          {loading ? '처리 중...' : `💳 유쓰레드 정기 구독 (${plan === 'yearly' ? '365일' : '30일'})`}
        </button>
        <div className="text-[10px] text-neutral-300 text-center mt-3">
          실제 카드 결제는 아직 연동 전이에요 — 구독 상태만 테스트로 켜집니다.
        </div>
      </div>
    </div>
  );
}
