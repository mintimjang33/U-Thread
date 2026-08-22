'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PremiumGate } from '../PremiumLock';

type ThreadPost = {
  id: string;
  topic: string;
  content: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  publish_error: string | null;
  account_username: string | null;
};
type Account = { id: string; username: string | null; threads_user_id: string };

const STATUS_TABS = [
  { key: '', label: '전체' },
  { key: 'draft', label: '임시저장' },
  { key: 'scheduled', label: '예약 대기' },
  { key: 'posted', label: '발행 완료' },
  { key: 'publishing', label: '발행 중' },
  { key: 'failed', label: '발행 실패' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: '임시저장', className: 'text-neutral-500' },
  scheduled: { label: '예약 대기', className: 'text-blue-600' },
  publishing: { label: '발행 중', className: 'text-amber-600' },
  posted: { label: '✔ 발행 완료', className: 'text-emerald-600' },
  failed: { label: '✕ 발행 실패', className: 'text-red-600' },
};

function ArchiveDashboard() {
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('');
  const [accountId, setAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (accountId) params.set('accountId', accountId);
    if (search) params.set('search', search);
    fetch(`/api/thread-posts?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setPosts(d.posts || []);
        setAccounts(d.accounts || []);
        setStatusCounts(d.statusCounts || {});
      })
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, accountId, search]);

  const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  if (!loaded) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label className="text-xs font-bold text-neutral-500">
          계정 선택:{' '}
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="border border-border px-2 py-1.5 text-xs ml-1">
            <option value="">전체 계정 ({accounts.length}개)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>@{a.username || a.threads_user_id}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5 ${status === t.key ? 'bg-black text-white' : 'border border-border text-neutral-500'}`}
          >
            {t.label} <span className="opacity-60">{t.key ? statusCounts[t.key] || 0 : totalCount}</span>
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="내용 검색..."
          className="ml-auto border border-border px-3 py-1.5 text-xs w-48"
        />
      </div>

      {posts.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center text-sm text-neutral-400">
          [ 조건에 맞는 게시물이 없습니다 ] <Link href="/write" className="underline font-bold text-black">지금 작성하러 가기</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const badge = STATUS_BADGE[p.status] || { label: p.status, className: 'text-neutral-400' };
            return (
              <div key={p.id} className="border border-border p-4">
                <div className="flex items-center justify-between mb-2 text-xs text-neutral-400">
                  <span>{p.account_username ? `@${p.account_username}` : '계정 미상'} · {new Date(p.created_at).toLocaleString('ko-KR')}</span>
                  <span className={`font-bold ${badge.className}`}>{badge.label}</span>
                </div>
                {p.status === 'scheduled' && p.scheduled_at && (
                  <div className="text-xs text-blue-600 mb-1">⏰ {new Date(p.scheduled_at).toLocaleString('ko-KR')} 예약됨</div>
                )}
                {p.status === 'failed' && p.publish_error && (
                  <div className="text-xs text-red-500 mb-1">{p.publish_error}</div>
                )}
                {p.topic && <div className="text-xs text-neutral-500 mb-1">{p.topic}</div>}
                <p className="text-sm whitespace-pre-wrap">{p.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ThreadsArchivePage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">내 게시물 보관함</h1>
      </div>
      <PremiumGate message="스마트 에디터로 작성하고 생성된 모든 브랜드 피드 및 타래 보관 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다.">
        <ArchiveDashboard />
      </PremiumGate>
    </div>
  );
}
