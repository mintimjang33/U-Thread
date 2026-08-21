'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type ThreadsAccount = { id: string; username: string | null; threads_user_id: string; token_expires_at: string | null };

const REDIRECT_URI = 'https://u-thread.vercel.app/api/auth/threads/callback';
const SCOPES = [
  'threads_basic',
  'threads_content_publish',
  'threads_manage_replies',
  'threads_read_replies',
  'threads_manage_insights',
  'threads_keyword_search',
].join(',');

export default function ThreadsManagePage() {
  return (
    <Suspense fallback={null}>
      <ThreadsManageInner />
    </Suspense>
  );
}

function ThreadsManageInner() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const appId = process.env.NEXT_PUBLIC_THREADS_APP_ID;

  function load() {
    fetch('/api/threads-accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []));
  }

  useEffect(() => {
    load();
    if (searchParams.get('connected')) setNotice('Threads 계정이 연동됐어요!');
    const err = searchParams.get('error');
    if (err) setNotice(`연동 실패: ${decodeURIComponent(err)}`);
  }, [searchParams]);

  function handleConnect() {
    if (!appId) {
      alert('Threads 앱이 아직 서버에 설정되지 않았어요. (THREADS_APP_ID 환경변수 필요)');
      return;
    }
    const url = `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES}&response_type=code`;
    window.location.href = url;
  }

  async function handleDisconnect(id: string) {
    await fetch(`/api/threads-accounts?id=${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">내 쓰레드 관리</h1>
      </div>

      {notice && <div className="mb-6 border border-border p-3 text-xs">{notice}</div>}

      {accounts.length > 0 && (
        <div className="space-y-3 mb-6">
          {accounts.map((a) => (
            <div key={a.id} className="border border-border p-4 flex items-center justify-between">
              <div>
                <div className="font-black text-sm">@{a.username || a.threads_user_id}</div>
                {a.token_expires_at && (
                  <div className="text-xs text-neutral-400">
                    {new Date(a.token_expires_at).toLocaleDateString('ko-KR')}까지 유효
                  </div>
                )}
              </div>
              <button onClick={() => handleDisconnect(a.id)} className="text-xs text-red-500 font-bold">연동 해제</button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-border p-10 text-center max-w-lg">
        <p className="text-sm text-neutral-600 mb-6">
          Meta Threads 계정을 연동하면 스마트/멀티 에디터에서 직접 게시물을 발행하고 관리할 수 있어요.
        </p>
        <button onClick={handleConnect} className="bg-black text-white text-[11px] font-black px-6 py-3">
          @ THREADS 계정 {accounts.length > 0 ? '추가 연동' : '연동하기'}
        </button>
      </div>
    </div>
  );
}
