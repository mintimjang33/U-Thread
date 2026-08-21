'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type RevenuePost = { id: string; title: string; amount: number; content: string; created_at: string; likes: number; views: number };

export default function RevenuePage() {
  const [posts, setPosts] = useState<RevenuePost[]>([]);

  useEffect(() => {
    fetch('/api/revenue')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-black inline-block" />
          <h1 className="text-xl font-black">수익 인증 라운지</h1>
        </div>
        <Link href="/dashboard/revenue/write" className="bg-black text-white text-[11px] font-black px-5 py-2.5">
          + 수익 인증하기
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center text-sm text-neutral-400">
          아직 등록된 수익 인증 글이 없어요. 첫 글을 남겨보세요.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {posts.map((p) => (
            <div key={p.id} className="border border-border p-5">
              <div className="text-xs text-neutral-400 mb-2">김**님 · {new Date(p.created_at).toLocaleDateString('ko-KR')}</div>
              <h3 className="font-black mb-1">{p.title}</h3>
              <div className="text-lg font-black text-blue-600 mb-2">₩{p.amount.toLocaleString()}</div>
              <p className="text-sm text-neutral-600 whitespace-pre-wrap line-clamp-3">{p.content}</p>
              <div className="flex gap-4 text-xs text-neutral-400 mt-3">
                <span>조회 {p.views}</span>
                <span>좋아요 {p.likes}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
