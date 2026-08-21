'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';

export default function MyPage() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogoutAll() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: 'global' });
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen bg-white p-10 max-w-lg mx-auto">
      <Link href="/dashboard" className="text-xs text-neutral-400 mb-6 inline-block">← 대시보드</Link>
      <h1 className="text-xl font-black mb-6">마이페이지</h1>

      <div className="border border-border p-6 mb-6">
        <h2 className="font-black text-sm mb-4">정보 변경</h2>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className="w-full border border-border px-3 py-2.5 text-sm" />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="회사명" className="w-full border border-border px-3 py-2.5 text-sm" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="새 비밀번호 교체" className="w-full border border-border px-3 py-2.5 text-sm" />
          <button className="w-full bg-black text-white text-[11px] font-black py-3">수정 사항 저장하기</button>
        </div>
      </div>

      <div className="border border-border bg-neutral-50 p-6 mb-6 text-center">
        <div className="font-black text-sm mb-2">보안 및 API 키 (SECURITY)</div>
        <p className="text-xs text-neutral-500 mb-4">쓰레드 다중 계정 연동 및 AI API 커스텀 볼트 연동 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다.</p>
        <Link href="/purchase" className="inline-block bg-black text-white text-[11px] font-black px-5 py-2.5">프리미엄 구독하기</Link>
      </div>

      <button onClick={handleLogoutAll} className="w-full border border-border text-[11px] font-black py-3">
        모든 세션 로그아웃
      </button>
    </div>
  );
}
