'use client';

import { useState } from 'react';

export default function PurchasePage() {
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);

  // TODO: 토스페이먼츠 정기결제(빌링키) API 연동. 지금은 실제 결제를 진행하지 않는 목업.
  function handlePay() {
    if (!agree1 || !agree2) {
      alert('약관에 모두 동의해주세요.');
      return;
    }
    alert('실제 결제 연동은 아직 준비 중이에요. (Phase 3)');
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="bg-white border border-border p-8 max-w-sm w-full">
        <h1 className="font-black text-lg mb-1">프리미엄 구독</h1>
        <p className="text-xs text-neutral-400 mb-6">유쓰레드 정기 구독권 결제 신청</p>

        <div className="border border-border p-5 mb-6">
          <div className="text-sm font-black mb-1">유쓰레드 30일 프리미엄 이용권</div>
          <div className="text-xs text-neutral-400 mb-3">이용기간: 30일</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-neutral-300 line-through">99,000원</span>
            <span className="text-xs font-black text-red-500">67% OFF</span>
          </div>
          <div className="text-2xl font-black">33,000원 <span className="text-xs font-normal text-neutral-400">(부가세 포함)</span></div>
        </div>

        <p className="text-[11px] text-neutral-400 mb-4 leading-relaxed">
          첫 결제 완료 후 매월 동일한 일자에 자동으로 정기 결제가 진행됩니다. 언제든지 마이페이지에서 구독 해지가 가능합니다.
        </p>

        <label className="flex items-center gap-2 text-xs mb-2">
          <input type="checkbox" checked={agree1} onChange={(e) => setAgree1(e.target.checked)} />
          소프트웨어 정기구독 서비스 이용약관 동의 (필수)
        </label>
        <label className="flex items-center gap-2 text-xs mb-6">
          <input type="checkbox" checked={agree2} onChange={(e) => setAgree2(e.target.checked)} />
          청약철회(환불) 제한 조건 동의 (필수)
        </label>

        <button onClick={handlePay} className="w-full bg-black text-white text-[11px] font-black py-4">
          💳 유쓰레드 정기 구독
        </button>
      </div>
    </div>
  );
}
