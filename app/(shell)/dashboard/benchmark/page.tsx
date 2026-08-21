'use client';

import { useEffect, useState } from 'react';

type Folder = { id: string; name: string };
type BenchmarkItem = { id: string; source: string; content: string; media_url: string | null; folder_id: string | null; created_at: string };

export default function BenchmarkPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<'all' | 'unfiled' | string>('all');
  const [items, setItems] = useState<BenchmarkItem[]>([]);
  const [search, setSearch] = useState('');

  const [showManual, setShowManual] = useState(false);
  const [showScrape, setShowScrape] = useState(false);
  const [showFolders, setShowFolders] = useState(false);

  const [source, setSource] = useState('');
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [manualFolder, setManualFolder] = useState('');
  const [saving, setSaving] = useState(false);

  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeFolder, setScrapeFolder] = useState('');
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);

  const [newFolderName, setNewFolderName] = useState('');

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [showExtension, setShowExtension] = useState(false);
  const [extensionKey, setExtensionKey] = useState<string | null>(null);
  const [issuingKey, setIssuingKey] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleOpenExtensionModal() {
    setShowExtension(true);
    if (extensionKey) return;
    setIssuingKey(true);
    try {
      const res = await fetch('/api/extension/issue-key', { method: 'POST' });
      const data = await res.json();
      setExtensionKey(data.token || null);
    } finally {
      setIssuingKey(false);
    }
  }

  function handleCopyKey() {
    if (!extensionKey) return;
    navigator.clipboard.writeText(extensionKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function loadFolders() {
    fetch('/api/benchmark/folders')
      .then((r) => r.json())
      .then((d) => setFolders(d.folders || []));
  }

  function loadItems(folderId: typeof activeFolder) {
    const q = folderId === 'all' ? '' : `?folder_id=${folderId}`;
    fetch(`/api/benchmark${q}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));
  }

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    loadItems(activeFolder);
    setSelected(new Set());
  }, [activeFolder]);

  async function handleManualSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      let media_url: string | undefined;
      if (mediaFile) {
        const fd = new FormData();
        fd.append('file', mediaFile);
        const up = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json());
        media_url = up.url;
      }
      await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, content, folder_id: manualFolder || null, media_url }),
      });
      setSource('');
      setContent('');
      setMediaFile(null);
      setManualFolder('');
      setShowManual(false);
      loadItems(activeFolder);
    } finally {
      setSaving(false);
    }
  }

  async function handleScrape() {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setScrapeError(null);
    try {
      const res = await fetch('/api/benchmark/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl, folder_id: scrapeFolder || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '스크랩 실패');
      setScrapeUrl('');
      setShowScrape(false);
      loadItems(activeFolder);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : String(err));
    } finally {
      setScraping(false);
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    await fetch('/api/benchmark/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    setNewFolderName('');
    loadFolders();
  }

  async function handleDeleteFolder(id: string) {
    await fetch(`/api/benchmark/folders?id=${id}`, { method: 'DELETE' });
    if (activeFolder === id) setActiveFolder('all');
    loadFolders();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    await fetch('/api/benchmark', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setSelectMode(false);
    loadItems(activeFolder);
  }

  const filtered = items.filter((it) => it.content.includes(search) || it.source.includes(search));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">벤치마킹 보관함</h1>
        <span className="text-[11px] bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-full">벤치마킹 보관함 사용법 보기</span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-500">
          📁 폴더 목록 ({folders.length}개)
        </div>
        <button onClick={() => setShowFolders(true)} className="border border-border px-3 py-1.5 text-[11px] font-black">
          + 폴더 관리
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setActiveFolder('all')}
          className={`px-3 py-1.5 text-[11px] font-bold ${activeFolder === 'all' ? 'bg-black text-white' : 'border border-border text-neutral-500'}`}
        >
          전체 보기
        </button>
        <button
          onClick={() => setActiveFolder('unfiled')}
          className={`px-3 py-1.5 text-[11px] font-bold ${activeFolder === 'unfiled' ? 'bg-black text-white' : 'border border-border text-neutral-500'}`}
        >
          미분류
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFolder(f.id)}
            className={`px-3 py-1.5 text-[11px] font-bold ${activeFolder === f.id ? 'bg-black text-white' : 'border border-border text-neutral-500'}`}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 border border-border px-3 py-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="원작자 ID 또는 내용 검색..."
            className="flex-1 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => setSelectMode((v) => !v)}
          className={`border border-border px-4 py-2.5 text-xs font-bold ${selectMode ? 'bg-neutral-100' : ''}`}
        >
          📋 선택 관리
        </button>
        <button onClick={() => setShowScrape(true)} className="bg-blue-600 text-white px-4 py-2.5 text-xs font-black flex items-center gap-1">
          🔗 링크로 스크랩
        </button>
        <button onClick={() => setShowManual(true)} className="bg-black text-white px-4 py-2.5 text-xs font-black flex items-center gap-1">
          + 수동 등록
        </button>
        <button onClick={handleOpenExtensionModal} className="border border-border px-4 py-2.5 text-xs font-bold flex items-center gap-1">🔑 익스텐션 키</button>
      </div>

      {selectMode && selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between bg-neutral-50 border border-border px-4 py-2.5 text-xs">
          <span className="font-bold">{selected.size}개 선택됨</span>
          <button onClick={handleBulkDelete} className="text-red-600 font-black">선택 삭제</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center text-sm text-neutral-400">
          [ 선택된 폴더에 보관된 글이 없습니다 ]
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => (
            <div key={it.id} className="border border-border p-4 flex gap-3">
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selected.has(it.id)}
                  onChange={() => toggleSelect(it.id)}
                  className="mt-1"
                />
              )}
              {it.media_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.media_url} alt="" className="w-16 h-16 object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {it.source && <div className="text-xs font-bold text-neutral-500 mb-1">{it.source}</div>}
                <p className="text-sm whitespace-pre-wrap">{it.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showManual && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowManual(false)}>
          <div className="bg-white p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">수동 등록</h2>
            <label className="text-xs font-bold text-neutral-500 mb-1 block">저장할 폴더</label>
            <select value={manualFolder} onChange={(e) => setManualFolder(e.target.value)} className="w-full border border-border px-3 py-2.5 text-sm mb-3">
              <option value="">미분류</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
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
              className="w-full border border-border px-3 py-2.5 text-sm mb-3"
            />
            <label className="text-xs font-bold text-neutral-500 mb-1 block">사진/동영상 첨부 (선택)</label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              className="w-full text-xs mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowManual(false)} className="flex-1 border border-border text-[11px] font-black py-3">
                취소
              </button>
              <button onClick={handleManualSave} disabled={saving} className="flex-1 bg-black text-white text-[11px] font-black py-3">
                {saving ? '저장 중...' : '보관함에 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScrape && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowScrape(false)}>
          <div className="bg-white p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">🔗 스레드 링크로 즉시 스크랩</h2>
            <label className="text-xs font-bold text-neutral-500 mb-1 block">스레드 글 링크 (URL)</label>
            <input
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder="https://www.threads.net/@user/post/... 또는 share/..."
              className="w-full border border-border px-3 py-2.5 text-sm mb-3"
            />
            <label className="text-xs font-bold text-neutral-500 mb-1 block">저장할 폴더 선택</label>
            <select value={scrapeFolder} onChange={(e) => setScrapeFolder(e.target.value)} className="w-full border border-border px-3 py-2.5 text-sm mb-3">
              <option value="">미분류</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {scrapeError && <div className="text-xs text-red-500 mb-3">{scrapeError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setShowScrape(false)} className="flex-1 border border-border text-[11px] font-black py-3">
                취소
              </button>
              <button onClick={handleScrape} disabled={scraping} className="flex-1 bg-blue-600 text-white text-[11px] font-black py-3">
                {scraping ? '스크랩 중...' : '스크랩 등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFolders && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowFolders(false)}>
          <div className="bg-white p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">📁 벤치마킹 폴더 관리</h2>
            <div className="flex gap-2 mb-4">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="새 폴더 이름 입력..."
                className="flex-1 border border-border px-3 py-2.5 text-sm"
              />
              <button onClick={handleCreateFolder} className="bg-black text-white text-[11px] font-black px-4">+ 생성</button>
            </div>
            {folders.length === 0 ? (
              <div className="text-xs text-neutral-400 text-center py-4">생성된 폴더가 없습니다.</div>
            ) : (
              <div className="space-y-2 mb-4">
                {folders.map((f) => (
                  <div key={f.id} className="flex items-center justify-between border border-border px-3 py-2 text-sm">
                    <span>{f.name}</span>
                    <button onClick={() => handleDeleteFolder(f.id)} className="text-xs text-red-500 font-bold">삭제</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowFolders(false)} className="w-full border border-border text-[11px] font-black py-3">
              닫기
            </button>
          </div>
        </div>
      )}

      {showExtension && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowExtension(false)}>
          <div className="bg-white p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-1">🔑 익스텐션 연동 키</h2>
            <p className="text-xs text-neutral-400 mb-4">
              크롬 익스텐션을 설치하고 이 키를 붙여넣으면, Threads 글에서 우클릭으로 바로 벤치마킹 보관함에 저장할 수 있어요.
            </p>
            {issuingKey ? (
              <div className="text-xs text-neutral-400 text-center py-6">키 발급 중...</div>
            ) : (
              <>
                <div className="border border-border p-3 text-xs break-all bg-neutral-50 mb-3 font-mono">{extensionKey}</div>
                <button onClick={handleCopyKey} className="w-full border border-border text-[11px] font-black py-2.5 mb-4">
                  {copied ? '복사됨 ✔' : '키 복사하기'}
                </button>
              </>
            )}
            <div className="text-[11px] text-neutral-500 space-y-1 mb-4">
              <div>1. 익스텐션을 크롬에 설치 (개발자모드 → 압축해제된 확장 프로그램 로드)</div>
              <div>2. 익스텐션 팝업에서 위 키를 붙여넣고 저장</div>
              <div>3. Threads 게시물에서 텍스트를 선택하고 우클릭 → &quot;유쓰레드 벤치마킹에 저장&quot;</div>
            </div>
            <button onClick={() => setShowExtension(false)} className="w-full bg-black text-white text-[11px] font-black py-3">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
