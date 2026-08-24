'use client';

import { useEffect, useState } from 'react';

type Pairing = { id: string; label: string | null; last_seen_at: string | null; created_at: string; expires_at: string | null; claude_email: string | null };
type Defaults = { ai_source: 'gemini' | 'worker' };

function isOnline(lastSeenAt: string | null) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 30000;
}

function isExpired(expiresAt: string | null) {
  return !!expiresAt && new Date(expiresAt).getTime() < Date.now();
}

function remainingLabel(expiresAt: string | null) {
  if (!expiresAt) return '무제한';
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  return days > 0 ? `남은 이용기간 ${days}일` : '만료됨';
}

export default function AiWorkerPage() {
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState('0');

  function load() {
    fetch('/api/editor-defaults').then((r) => r.json()).then((d) => setDefaults(d.defaults));
    fetch('/api/worker/pair').then((r) => r.json()).then((d) => setPairings(d.pairings || []));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  async function setAiSource(source: 'gemini' | 'worker') {
    await fetch('/api/editor-defaults', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_source: source }),
    });
    load();
  }

  async function issueToken() {
    setIssuing(true);
    try {
      const res = await fetch('/api/worker/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: `이용권 ${new Date().toLocaleDateString('ko-KR')}`, durationDays: Number(durationDays) }),
      });
      const data = await res.json();
      setNewToken(data.token);
      load();
    } finally {
      setIssuing(false);
    }
  }

  async function revokePairing(id: string) {
    if (!confirm('이 워커 연결을 해제할까요?')) return;
    await fetch(`/api/worker/pair?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function startCollect() {
    setCollecting(true);
    setCollectResult(null);
    try {
      const res = await fetch('/api/worker/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'collect_benchmark', input: { keyword, maxScrolls: 5 } }),
      });
      const { job } = await res.json();
      const poll = setInterval(async () => {
        const r = await fetch(`/api/worker/jobs/${job.id}`).then((r) => r.json());
        if (r.job.status === 'done') {
          clearInterval(poll);
          setCollecting(false);
          setCollectResult(`✅ ${r.job.output?.items?.length ?? 0}개 수집해서 벤치마킹 보관함에 넣었어요.`);
        } else if (r.job.status === 'failed') {
          clearInterval(poll);
          setCollecting(false);
          setCollectResult(`❌ 실패: ${r.job.error}`);
        }
      }, 3000);
    } catch (err) {
      setCollecting(false);
      setCollectResult(`❌ 오류: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const anyOnline = pairings.some((p) => isOnline(p.last_seen_at) && !isExpired(p.expires_at));
  const everPaired = pairings.some((p) => !isExpired(p.expires_at));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-accent inline-block" />
        <h1 className="text-xl font-black">My PC 반자동 (클로드 구독 연결)</h1>
      </div>

      <div className="border border-border p-6 mb-6">
        <h2 className="font-black text-sm mb-1">1. 글 생성 방식</h2>
        <p className="text-xs text-neutral-400 mb-4">
          Gemini API는 생성할 때마다 API 요금이 붙어요. 로컬 워커를 연결하면 사용자 PC에 설치된 클로드 구독(정액제) 안에서 생성돼서 추가 과금이 없어요.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setAiSource('gemini')}
            className={`flex-1 border p-4 text-left ${defaults?.ai_source === 'gemini' ? 'border-black bg-neutral-50' : 'border-border'}`}
          >
            <div className="font-black text-sm mb-1">Gemini API</div>
            <div className="text-[11px] text-neutral-400">생성량만큼 API 과금</div>
          </button>
          <button
            onClick={() => setAiSource('worker')}
            disabled={!everPaired}
            className={`flex-1 border p-4 text-left disabled:opacity-40 ${defaults?.ai_source === 'worker' ? 'border-black bg-neutral-50' : 'border-border'}`}
          >
            <div className="font-black text-sm mb-1">My PC 반자동 (클로드 구독)</div>
            <div className="text-[11px] text-neutral-400">
              {!everPaired ? '이용권 발급 후 선택 가능' : anyOnline ? '추가 과금 없음 · 지금 온라인' : '추가 과금 없음 · 지금은 오프라인(3_start.bat 켜야 실제 생성됨)'}
            </div>
          </button>
        </div>
      </div>

      <div className="border border-border p-6 mb-6">
        <h2 className="font-black text-sm mb-1">2. 이용권 발급 &amp; 워커 연결</h2>
        <p className="text-xs text-neutral-400 mb-4">
          이용권 코드를 발급해서 사용자 PC의 <code>worker/</code> 폴더(레포에 포함됨)에서 <code>npm install</code> → <code>node pair.js</code>로 붙여넣고, <code>node index.js</code>로 상시 실행하면 돼요.
          로컬에 Chrome과 <code>claude</code> CLI(로그인 완료 상태)가 필요해요. 나중에 이 이용권 발급 방식 그대로 남에게 판매할 때도 쓸 수 있어요(기간 제한 지원).
        </p>
        <div className="flex items-center gap-2 mb-4">
          <select value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="border border-border px-2 py-2.5 text-xs">
            <option value="0">무제한</option>
            <option value="1">1일</option>
            <option value="7">7일</option>
            <option value="30">30일</option>
            <option value="90">90일</option>
          </select>
          <button onClick={issueToken} disabled={issuing} className="bg-accent text-white text-[11px] font-black px-5 py-3">
            {issuing ? '발급 중...' : '+ 이용권 발급'}
          </button>
        </div>
        {newToken && (
          <div className="border border-amber-300 bg-amber-50 p-3 mb-4 text-xs break-all">
            <div className="font-bold mb-1">⚠️ 이 코드는 지금만 보여요. node pair.js 실행 시 붙여넣으세요.</div>
            {newToken}
          </div>
        )}

        <div className="space-y-2">
          {pairings.map((p) => {
            const expired = isExpired(p.expires_at);
            return (
              <div key={p.id} className="flex items-center justify-between border border-border p-3 text-xs">
                <div>
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${!expired && isOnline(p.last_seen_at) ? 'bg-green-500' : 'bg-neutral-300'}`} />
                  {p.label || '이용권'} — {expired ? '만료됨' : isOnline(p.last_seen_at) ? '온라인' : p.last_seen_at ? `마지막 접속: ${new Date(p.last_seen_at).toLocaleString('ko-KR')}` : '아직 연결 안 됨'}
                  <span className="text-neutral-400"> · {remainingLabel(p.expires_at)}</span>
                  {p.claude_email && <span className="text-neutral-400"> · 클로드 계정: {p.claude_email}</span>}
                </div>
                <button onClick={() => revokePairing(p.id)} className="text-red-500 font-bold">
                  연결 해제
                </button>
              </div>
            );
          })}
          {pairings.length === 0 && <div className="text-xs text-neutral-400">아직 발급한 이용권이 없어요.</div>}
        </div>
      </div>

      <div className="border border-border p-6">
        <h2 className="font-black text-sm mb-1">3. 원본 수집 자동화</h2>
        <p className="text-xs text-neutral-400 mb-4">키워드로 쓰레드를 검색해서 텍스트 위주 글을 자동으로 벤치마킹 보관함에 모아요. 워커가 온라인이어야 동작해요.</p>
        <div className="flex gap-2 mb-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 다이소 꿀템"
            className="flex-1 border border-border px-3 py-2.5 text-sm"
          />
          <button
            onClick={startCollect}
            disabled={!anyOnline || collecting || !keyword.trim()}
            className="bg-accent text-white text-[11px] font-black px-5 py-3 disabled:opacity-40"
          >
            {collecting ? '수집 중...' : '원본 수집 시작'}
          </button>
        </div>
        {collectResult && <div className="text-xs mt-2">{collectResult}</div>}
      </div>
    </div>
  );
}
