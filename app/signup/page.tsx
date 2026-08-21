'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';

export default function SignupPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    password: '',
    passwordConfirm: '',
    referral: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGoogleSignup() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!agreed) {
      setError('이용약관에 동의해주세요.');
      return;
    }
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name, company: form.company, phone: form.phone, referral: form.referral } },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md bg-white border border-border p-8">
        <div className="text-center mb-8">
          <h1 className="font-black text-lg mb-1">유쓰레드와 함께 스마트한 오케스트레이션을 시작하세요</h1>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          className="w-full border border-border py-3 text-sm font-bold mb-4 hover:bg-neutral-50"
        >
          Google로 계속하기
        </button>

        <div className="flex items-center gap-3 my-4 text-xs text-neutral-400">
          <div className="flex-1 h-px bg-border" />
          또는 이메일로 가입
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <input placeholder="이름*" value={form.name} onChange={(e) => setField('name', e.target.value)} required className="border border-border px-3 py-2.5 text-sm col-span-1" />
          <input type="email" placeholder="이메일*" value={form.email} onChange={(e) => setField('email', e.target.value)} required className="border border-border px-3 py-2.5 text-sm col-span-1" />
          <input placeholder="전화번호*" value={form.phone} onChange={(e) => setField('phone', e.target.value)} required className="border border-border px-3 py-2.5 text-sm col-span-1" />
          <input placeholder="회사명(없으면 이름)" value={form.company} onChange={(e) => setField('company', e.target.value)} className="border border-border px-3 py-2.5 text-sm col-span-1" />
          <input type="password" placeholder="비밀번호*" value={form.password} onChange={(e) => setField('password', e.target.value)} required className="border border-border px-3 py-2.5 text-sm col-span-1" />
          <input type="password" placeholder="비밀번호 확인*" value={form.passwordConfirm} onChange={(e) => setField('passwordConfirm', e.target.value)} required className="border border-border px-3 py-2.5 text-sm col-span-1" />
          <input placeholder="추천인 ID (선택)" value={form.referral} onChange={(e) => setField('referral', e.target.value)} className="border border-border px-3 py-2.5 text-sm col-span-2" />

          <label className="col-span-2 flex items-center gap-2 text-xs text-neutral-600 mt-1">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            웹사이트 이용약관에 동의합니다 (필수)
          </label>

          {error && <div className="col-span-2 text-xs text-red-500">{error}</div>}

          <button type="submit" disabled={loading} className="col-span-2 bg-black text-white py-3 text-[11px] font-black mt-2">
            {loading ? '처리 중...' : '회원가입 완료'}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-neutral-500">
          이미 계정이 있으신가요? <Link href="/login" className="font-black text-black">로그인</Link>
        </div>
      </div>
    </div>
  );
}
