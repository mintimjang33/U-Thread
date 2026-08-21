'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RevenueWritePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleFileSelect(file: File | null) {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let image_url: string | undefined;
      if (imageFile) {
        const fd = new FormData();
        fd.append('file', imageFile);
        const up = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json());
        image_url = up.url;
      }
      await fetch('/api/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, amount, content, image_url }),
      });
      router.push('/dashboard/revenue');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-black mb-6">수익 인증 글 작성</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목*"
          required
          className="w-full border border-border px-3 py-3 text-sm"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="수익 금액(원)*"
          required
          className="w-full border border-border px-3 py-3 text-sm"
        />
        <label className="block border border-dashed border-border p-6 text-center text-xs text-neutral-400 cursor-pointer">
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="" className="max-h-40 mx-auto object-contain" />
          ) : (
            <>클릭하여 이미지 업로드<br />PNG, JPG, GIF (최대 5MB)</>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          />
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="상세 내용"
          rows={6}
          className="w-full border border-border px-3 py-3 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => router.back()} className="flex-1 border border-border text-[11px] font-black py-3">
            취소
          </button>
          <button type="submit" disabled={saving} className="flex-1 bg-black text-white text-[11px] font-black py-3">
            {saving ? '등록 중...' : '인증 글 등록하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
