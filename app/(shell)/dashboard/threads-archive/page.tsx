'use client';

import { useEffect, useState } from 'react';
import { PremiumGate } from '../PremiumLock';

type ThreadPost = { id: string; topic: string; content: string; created_at: string; account_username: string | null };

function ArchiveList() {
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/thread-posts')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  if (posts.length === 0) {
    return (
      <div className="border border-dashed border-border p-16 text-center text-sm text-neutral-400">
        아직 발행한 게시물이 없어요. <a href="/write" className="underline font-bold text-black">지금 작성하러 가기</a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <div key={p.id} className="border border-border p-4">
          <div className="flex items-center justify-between mb-2 text-xs text-neutral-400">
            <span>{p.account_username ? `@${p.account_username}` : '계정 미상'} · {new Date(p.created_at).toLocaleString('ko-KR')}</span>
            <span className="text-emerald-600 font-bold">✔ 발행됨</span>
          </div>
          {p.topic && <div className="text-xs text-neutral-500 mb-1">{p.topic}</div>}
          <p className="text-sm whitespace-pre-wrap">{p.content}</p>
        </div>
      ))}
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
        <ArchiveList />
      </PremiumGate>
    </div>
  );
}
