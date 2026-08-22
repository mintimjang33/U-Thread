'use client';

import { useEffect, useState } from 'react';

type AdminUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  isSubscribed: boolean;
  expiresAt: string | null;
};

export default function AdminPage() {
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadUsers() {
    setLoading(true);
    setError(null);
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setUsers(d.users || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch('/api/admin/check')
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(!!d.isAdmin);
        setChecked(true);
        if (d.isAdmin) loadUsers();
      });
  }, []);

  async function handleAction(userId: string, action: 'grant' | 'revoke', days?: number) {
    setBusyId(userId);
    try {
      await fetch('/api/admin/users/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, days }),
      });
      loadUsers();
    } finally {
      setBusyId(null);
    }
  }

  if (!checked) return null;

  if (!isAdmin) {
    return (
      <div className="border border-border bg-neutral-50 p-10 text-center max-w-lg mx-auto mt-10">
        <div className="text-3xl mb-4">🔒</div>
        <p className="text-sm text-neutral-600">관리자 전용 페이지예요.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-accent inline-block" />
          <h1 className="text-xl font-black">관리자 — 사용자 &amp; 구독 현황</h1>
        </div>
        <button onClick={loadUsers} className="border border-border px-4 py-2.5 text-xs font-bold">
          새로고침
        </button>
      </div>

      <div className="text-xs text-neutral-400 mb-4">총 {users.length}명</div>

      {error && <div className="text-xs text-red-500 mb-4">{error}</div>}
      {loading ? (
        <div className="text-sm text-neutral-400 py-16 text-center">불러오는 중...</div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-neutral-50 text-left">
                <th className="p-3 font-black">이메일</th>
                <th className="p-3 font-black">가입일</th>
                <th className="p-3 font-black">최근 로그인</th>
                <th className="p-3 font-black">구독 상태</th>
                <th className="p-3 font-black">만료일</th>
                <th className="p-3 font-black">액션</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border">
                  <td className="p-3 font-bold">
                    {u.email} {u.isAdmin && <span className="ml-1 text-[10px] bg-accent text-white px-1.5 py-0.5">관리자</span>}
                  </td>
                  <td className="p-3 text-neutral-400">{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
                  <td className="p-3 text-neutral-400">{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString('ko-KR') : '-'}</td>
                  <td className="p-3">
                    {u.isSubscribed ? (
                      <span className="text-emerald-600 font-bold">● 프리미엄</span>
                    ) : (
                      <span className="text-neutral-400 font-bold">● 무료</span>
                    )}
                  </td>
                  <td className="p-3 text-neutral-400">{u.expiresAt ? new Date(u.expiresAt).toLocaleDateString('ko-KR') : '-'}</td>
                  <td className="p-3">
                    {u.isAdmin ? (
                      <span className="text-neutral-300">-</span>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAction(u.id, 'grant', 30)}
                          disabled={busyId === u.id}
                          className="border border-border px-2 py-1 font-bold hover:bg-neutral-50"
                        >
                          +30일
                        </button>
                        <button
                          onClick={() => handleAction(u.id, 'grant', 365)}
                          disabled={busyId === u.id}
                          className="border border-border px-2 py-1 font-bold hover:bg-neutral-50"
                        >
                          +365일
                        </button>
                        {u.isSubscribed && (
                          <button
                            onClick={() => handleAction(u.id, 'revoke')}
                            disabled={busyId === u.id}
                            className="border border-border px-2 py-1 font-bold text-red-500 hover:bg-red-50"
                          >
                            해제
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
