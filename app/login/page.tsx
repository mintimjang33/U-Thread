'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm bg-white border border-border p-8">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-black mx-auto mb-3">U</div>
          <h1 className="font-black text-lg">유쓰레드 로그인</h1>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full border border-border py-3 text-sm font-bold mb-4 hover:bg-neutral-50"
        >
          Google로 계속하기
        </button>

        <div className="flex items-center gap-3 my-4 text-xs text-neutral-400">
          <div className="flex-1 h-px bg-border" />
          또는
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-border px-3 py-3 text-sm"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-border px-3 py-3 text-sm"
          />
          {error && <div className="text-xs text-red-500">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-accent text-white py-3 text-[11px] font-black">
            {loading ? '접속 중...' : '시스템 접속 (LOGIN)'}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-neutral-500">
          계정이 없으신가요? <Link href="/signup" className="font-black text-black">회원가입</Link>
        </div>
        <div className="text-center mt-4 text-[10px] text-neutral-300 font-black tracking-wide">
          SECURED BY 유쓰레드 VAULT
        </div>
      </div>
    </div>
  );
}
