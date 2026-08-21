'use client';

import { useEffect, useState } from 'react';
import { PremiumGate } from '../PremiumLock';

type Video = { id: string; category: string; title: string; hashtags: string[]; video_url: string; created_at: string };

function ArchiveBrowser() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadHashtags, setUploadHashtags] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function load() {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    fetch(`/api/archive?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setVideos(d.videos || []);
        setCategoryCounts(d.categoryCounts || {});
        setTotal(d.total || 0);
      });
  }

  useEffect(() => {
    load();
  }, [category, search]);

  async function handleUpload() {
    if (!uploadCategory.trim() || !uploadTitle.trim() || !uploadFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const up = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json());
      if (!up.url) throw new Error(up.error || '업로드 실패');

      await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: uploadCategory,
          title: uploadTitle,
          hashtags: uploadHashtags.split(/[\s,#]+/).filter(Boolean),
          videoUrl: up.url,
        }),
      });
      setShowUpload(false);
      setUploadCategory('');
      setUploadTitle('');
      setUploadHashtags('');
      setUploadFile(null);
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="검색 (제목/키워드)"
          className="flex-1 min-w-[200px] border border-border px-3 py-2.5 text-sm"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="border border-border px-3 py-2.5 text-sm">
          <option value="">모든 카테고리 (전체)</option>
          {Object.entries(categoryCounts).map(([c, n]) => (
            <option key={c} value={c}>{c} ({n})</option>
          ))}
        </select>
        <button onClick={() => setShowUpload(true)} className="bg-black text-white text-xs font-black px-4 py-2.5">
          + 영상 소재 업로드
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center text-sm text-neutral-400">
          {total === 0 ? '아직 업로드된 영상 소재가 없어요. 첫 소재를 올려보세요.' : '검색 결과가 없어요.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {videos.map((v) => (
            <div key={v.id} className="border border-border">
              <video src={v.video_url} controls className="w-full aspect-[9/16] bg-black object-cover" />
              <div className="p-3">
                <div className="text-[10px] text-neutral-400 mb-1">{v.category}</div>
                <div className="text-sm font-bold mb-2">{v.title}</div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {v.hashtags.map((h) => (
                    <span key={h} className="text-[10px] text-neutral-400">#{h}</span>
                  ))}
                </div>
                <a href={v.video_url} download className="block text-center text-[11px] font-black border border-border py-2">
                  다운로드
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowUpload(false)}>
          <div className="bg-white p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">영상 소재 업로드</h2>
            <input
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              placeholder="카테고리 (예: 주방용품)"
              className="w-full border border-border px-3 py-2.5 text-sm mb-3"
            />
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="제목/상품명"
              className="w-full border border-border px-3 py-2.5 text-sm mb-3"
            />
            <input
              value={uploadHashtags}
              onChange={(e) => setUploadHashtags(e.target.value)}
              placeholder="해시태그 (공백 또는 콤마로 구분, 예: 생활용품 가성비)"
              className="w-full border border-border px-3 py-2.5 text-sm mb-3"
            />
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-xs mb-4"
            />
            {uploadError && <div className="text-xs text-red-500 mb-3">{uploadError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setShowUpload(false)} className="flex-1 border border-border text-[11px] font-black py-3">취소</button>
              <button onClick={handleUpload} disabled={uploading} className="flex-1 bg-black text-white text-[11px] font-black py-3">
                {uploading ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VideosArchivePage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">유쓰레드 아카이브</h1>
      </div>
      <PremiumGate message="고화질 원본 숏폼 비디오 소재 아카이브 전체 열람 및 다운로드 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다.">
        <ArchiveBrowser />
      </PremiumGate>
    </div>
  );
}
