'use client';

import { useEffect, useState } from 'react';

type BenchmarkItem = { id: string; source: string; content: string; created_at: string };

export default function BenchmarkPage() {
  const [items, setItems] = useState<BenchmarkItem[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [source, setSource] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    fetch('/api/benchmark')
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, content }),
      });
      setSource('');
      setContent('');
      setShowModal(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const filtered = items.filter(
    (it) => it.content.includes(search) || it.source.includes(search)
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">벤치마킹 보관함</h1>
        <span className="text-[11px] bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-full">벤치마킹 보관함 사용법 보기</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 border border-border px-3 py-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="원작자 ID 또는 내용 검색..."
            className="flex-1 text-sm outline-none"
          />
        </div>
        <button className="border border-border px-4 py-2.5 text-xs font-bold flex items-center gap-1">🔑 익스텐션(크롬) 키 연동</button>
        <button onClick={() => setShowModal(true)} className="bg-black text-white px-4 py-2.5 text-xs font-black flex items-center gap-1">
          + 수동으로 텍스트 복붙하기
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center text-sm text-neutral-400">
          [ 보관함 비어있음 / 익스텐션 우클릭으로 스크래핑을 실행하세요 ]
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => (
            <div key={it.id} className="border border-border p-4">
              {it.source && <div className="text-xs font-bold text-neutral-500 mb-1">{it.source}</div>}
              <p className="text-sm whitespace-pre-wrap">{it.content}</p>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">수동으로 텍스트 복붙하기</h2>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="작성자/출처 (선택, 예: 쓰레드 @insight_kr)"
              className="w-full border border-border px-3 py-2.5 text-sm mb-3"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="본문 내용*"
              rows={6}
              className="w-full border border-border px-3 py-2.5 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-border text-[11px] font-black py-3">
                취소
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-black text-white text-[11px] font-black py-3">
                {saving ? '저장 중...' : '보관함에 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
