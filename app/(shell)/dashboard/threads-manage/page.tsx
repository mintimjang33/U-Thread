'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { THREADS_SCOPE_STRING } from '../../../../lib/threadsScopes';

type ThreadsAccount = { id: string; username: string | null; threads_user_id: string; token_expires_at: string | null };
type Mention = { id: string; text: string; username: string; permalink: string; timestamp: string };
type ScopeStatus = { key: string; label: string; granted: boolean };

const REDIRECT_URI = 'https://u-thread.vercel.app/api/auth/threads/callback';
const SCOPES = THREADS_SCOPE_STRING;

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
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const appId = process.env.NEXT_PUBLIC_THREADS_APP_ID;

  const [mentionsAccount, setMentionsAccount] = useState<ThreadsAccount | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [mentionsLoading, setMentionsLoading] = useState(false);
  const [mentionsError, setMentionsError] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [repliedIds, setRepliedIds] = useState<Set<string>>(new Set());

  const [permAccount, setPermAccount] = useState<ThreadsAccount | null>(null);
  const [permScopes, setPermScopes] = useState<ScopeStatus[] | null>(null);
  const [permSupported, setPermSupported] = useState(true);
  const [permMessage, setPermMessage] = useState<string | null>(null);
  const [permLoading, setPermLoading] = useState(false);

  function load() {
    fetch('/api/threads-accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []));
    fetch('/api/subscription')
      .then((r) => r.json())
      .then((d) => setIsSubscribed(!!d.isSubscribed));
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
    if (accounts.length >= 1 && !isSubscribed) {
      setShowUpgrade(true);
      return;
    }
    const url = `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES}&response_type=code`;
    window.location.href = url;
  }

  async function handleDisconnect(id: string) {
    await fetch(`/api/threads-accounts?id=${id}`, { method: 'DELETE' });
    load();
  }

  function openMentions(account: ThreadsAccount) {
    setMentionsAccount(account);
    setMentions([]);
    setMentionsError(null);
    setRepliedIds(new Set());
    setMentionsLoading(true);
    fetch(`/api/threads-accounts/mentions?accountId=${account.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setMentions(d.mentions || []);
      })
      .catch((err) => setMentionsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setMentionsLoading(false));
  }

  function openPermissions(account: ThreadsAccount) {
    setPermAccount(account);
    setPermScopes(null);
    setPermMessage(null);
    setPermSupported(true);
    setPermLoading(true);
    fetch(`/api/threads-accounts/permissions?accountId=${account.id}`)
      .then((r) => r.json())
      .then((d) => {
        setPermSupported(!!d.supported);
        if (d.supported) setPermScopes(d.scopes || []);
        else setPermMessage(d.message || '권한 상세를 확인할 수 없어요.');
      })
      .catch(() => {
        setPermSupported(false);
        setPermMessage('권한 조회 중 오류가 발생했어요.');
      })
      .finally(() => setPermLoading(false));
  }

  async function handleReplyMention(mentionId: string) {
    if (!mentionsAccount || !replyDraft[mentionId]?.trim()) return;
    setReplyingId(mentionId);
    try {
      const res = await fetch('/api/threads-accounts/mentions/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: mentionsAccount.id, mentionId, text: replyDraft[mentionId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '답글 실패');
      setRepliedIds((prev) => new Set(prev).add(mentionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setReplyingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-accent inline-block" />
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
              <div className="flex items-center gap-3">
                <button onClick={() => openPermissions(a)} className="text-xs text-neutral-500 font-bold cursor-pointer hover:text-black">🔍 권한 상태</button>
                <button onClick={() => openMentions(a)} className="text-xs text-neutral-500 font-bold cursor-pointer hover:text-black">💬 멘션함</button>
                <button onClick={() => handleDisconnect(a.id)} className="text-xs text-red-500 font-bold cursor-pointer hover:text-red-700">연동 해제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-border p-10 text-center max-w-lg">
        <p className="text-sm text-neutral-600 mb-6">
          Meta Threads 계정을 연동하면 스마트/멀티 에디터에서 직접 게시물을 발행하고 관리할 수 있어요.
        </p>
        <button onClick={handleConnect} className="bg-accent text-white text-[11px] font-black px-6 py-3">
          @ THREADS 계정 {accounts.length > 0 ? '추가 연동' : '연동하기'}
        </button>
        {!isSubscribed && (
          <div className="text-[10px] text-neutral-400 mt-3">무료 회원은 1개 계정까지 연동할 수 있어요.</div>
        )}
      </div>

      {permAccount && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPermAccount(null)}>
          <div className="bg-white p-8 max-w-sm w-full rounded-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-1">🔍 @{permAccount.username || permAccount.threads_user_id} 권한 상태</h2>
            <p className="text-xs text-neutral-400 mb-4">이 계정 토큰에 실제로 부여된 권한이에요. 문제가 있으면 어떤 권한이 막혀있는지 여기서 바로 보여요.</p>
            {permLoading ? (
              <div className="text-sm text-neutral-400 text-center py-8">확인 중...</div>
            ) : !permSupported ? (
              <div className="text-xs text-neutral-500 border border-dashed border-border p-4 text-center">
                {permMessage || 'Threads가 권한 상세 조회를 지원하지 않아요.'}
                <div className="text-[10px] text-neutral-400 mt-2">실제 기능을 써봐야 확인 가능해요(예: 멘션함, 삭제 버튼).</div>
              </div>
            ) : (
              <div className="space-y-1.5 mb-2">
                {(permScopes || []).map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-xs border border-border px-3 py-2">
                    <span className="font-bold">{s.label}</span>
                    {s.granted ? (
                      <span className="text-emerald-600 font-black">✔ 사용 가능</span>
                    ) : (
                      <span className="text-red-500 font-black">✕ 권한 없음</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setPermAccount(null)} className="w-full border border-border text-[11px] font-black py-3 mt-4">
              닫기
            </button>
          </div>
        </div>
      )}

      {mentionsAccount && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setMentionsAccount(null)}>
          <div className="bg-white p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto rounded-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-1">💬 @{mentionsAccount.username || mentionsAccount.threads_user_id} 멘션함</h2>
            <p className="text-xs text-neutral-400 mb-4">이 계정을 언급한 공개 게시물이에요. 답글을 달 수 있어요.</p>
            {mentionsLoading ? (
              <div className="text-sm text-neutral-400 text-center py-10">불러오는 중...</div>
            ) : mentionsError ? (
              <div className="text-xs text-red-500">{mentionsError}</div>
            ) : mentions.length === 0 ? (
              <div className="text-sm text-neutral-400 text-center py-10">아직 언급된 게시물이 없어요.</div>
            ) : (
              <div className="space-y-3">
                {mentions.map((m) => (
                  <div key={m.id} className="border border-border p-3">
                    <div className="text-xs text-neutral-400 mb-1">@{m.username} · {new Date(m.timestamp).toLocaleString('ko-KR')}</div>
                    <p className="text-sm whitespace-pre-wrap mb-2">{m.text}</p>
                    {repliedIds.has(m.id) ? (
                      <div className="text-[11px] font-bold text-emerald-600">✔ 답글 완료</div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          value={replyDraft[m.id] || ''}
                          onChange={(e) => setReplyDraft((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          placeholder="답글 작성..."
                          className="flex-1 border border-border px-2.5 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => handleReplyMention(m.id)}
                          disabled={replyingId === m.id}
                          className="bg-accent text-white text-[11px] font-black px-3"
                        >
                          {replyingId === m.id ? '전송 중...' : '답글'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setMentionsAccount(null)} className="w-full border border-border text-[11px] font-black py-3 mt-4">
              닫기
            </button>
          </div>
        </div>
      )}

      {showUpgrade && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowUpgrade(false)}>
          <div className="bg-white p-8 max-w-sm w-full rounded-card" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold mb-6">
              다중 Threads 계정 연동은 프리미엄 멤버십 전용입니다. 무료 회원은 1개 계정까지 연동할 수 있어요.
            </p>
            <div className="flex gap-2">
              <Link href="/purchase" className="flex-1 text-center bg-accent text-white text-[11px] font-black py-3">
                구독하기
              </Link>
              <button onClick={() => setShowUpgrade(false)} className="flex-1 border border-border text-[11px] font-black py-3">
                나중에 할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
