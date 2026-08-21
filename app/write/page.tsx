'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PremiumGate } from '../dashboard/PremiumLock';

type Persona = { id: string; name: string };
type ThreadPost = { id: string; topic: string; content: string; status: string; created_at: string };

function SmartEditor() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [topic, setTopic] = useState('');
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadPosts() {
    fetch('/api/smart-editor')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []));
  }

  useEffect(() => {
    fetch('/api/personas')
      .then((r) => r.json())
      .then((d) => setPersonas(d.personas || []));
    loadPosts();
  }, []);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/smart-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, personaId: personaId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setTopic('');
      loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="border border-border p-6 mb-6">
        <h2 className="font-black text-sm mb-4">AI 스마트 에디터</h2>
        {personas.length > 0 && (
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="w-full border border-border px-3 py-2.5 text-sm mb-3">
            <option value="">페르소나 없음 (기본 톤)</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {personas.length === 0 && (
          <div className="text-xs text-neutral-400 mb-3">
            페르소나가 없어요. <Link href="/dashboard/personas" className="underline font-bold text-black">페르소나 관리</Link>에서 먼저 만들어보세요 (선택사항).
          </div>
        )}
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="어떤 주제로 글을 쓸까요? (예: 아침 루틴 바꾸고 생긴 변화)"
          rows={3}
          className="w-full border border-border px-3 py-2.5 text-sm mb-3"
        />
        {error && <div className="text-xs text-red-500 mb-3">{error}</div>}
        <button onClick={handleGenerate} disabled={generating} className="w-full bg-black text-white text-[11px] font-black py-3">
          {generating ? 'AI가 쓰는 중...' : '초안 생성하기'}
        </button>
        <div className="text-[10px] text-neutral-400 mt-2">
          Gemini API 키가 필요해요 (<Link href="/onboarding" className="underline">등록하러 가기</Link>)
        </div>
      </div>

      <h2 className="font-black text-sm mb-3">내 초안</h2>
      {posts.length === 0 ? (
        <div className="text-sm text-neutral-400">아직 생성한 초안이 없어요.</div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="border border-border p-4">
              <div className="text-xs text-neutral-400 mb-2">{p.topic} · {new Date(p.created_at).toLocaleString('ko-KR')}</div>
              <p className="text-sm whitespace-pre-wrap mb-3">{p.content}</p>
              <button disabled className="text-[11px] font-black text-neutral-300 border border-border px-4 py-2 cursor-not-allowed">
                쓰레드에 발행 (Threads 연동 후 가능 — /dashboard/threads-manage)
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SmartEditorPage() {
  return (
    <div className="p-10">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">스마트 에디터</h1>
      </div>
      <PremiumGate message="AI 스마트 에디터 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다.">
        <SmartEditor />
      </PremiumGate>
    </div>
  );
}
