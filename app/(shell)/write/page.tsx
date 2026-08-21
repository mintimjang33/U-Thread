'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PremiumGate } from '../dashboard/PremiumLock';

type Persona = { id: string; name: string };
type ThreadPost = {
  id: string;
  topic: string;
  content: string;
  status: string;
  created_at: string;
  threads_account_id: string | null;
  affiliate_comment: string | null;
};
type ThreadsAccount = { id: string; username: string | null; threads_user_id: string };
type AffiliateTemplate = { id: string; name: string; body: string };

const VARIABLES = ['[제품명]', '[제휴링크]', '[가격]', '[혜택]', '[심의문구]'];

function SmartEditor() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [topic, setTopic] = useState('');
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [publishAccount, setPublishAccount] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [affiliateTemplates, setAffiliateTemplates] = useState<AffiliateTemplate[]>([]);
  const [affiliateModalPost, setAffiliateModalPost] = useState<ThreadPost | null>(null);
  const [affiliateDraft, setAffiliateDraft] = useState('');
  const [savingAffiliate, setSavingAffiliate] = useState(false);

  function loadPosts() {
    fetch('/api/smart-editor')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []));
  }

  useEffect(() => {
    fetch('/api/personas')
      .then((r) => r.json())
      .then((d) => setPersonas(d.personas || []));
    fetch('/api/threads-accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []));
    fetch('/api/affiliate-templates')
      .then((r) => r.json())
      .then((d) => setAffiliateTemplates([...(d.systemTemplates || []), ...(d.templates || [])]));
    loadPosts();
  }, []);

  function openAffiliateModal(post: ThreadPost) {
    setAffiliateModalPost(post);
    setAffiliateDraft(post.affiliate_comment || '');
  }

  async function saveAffiliateComment() {
    if (!affiliateModalPost) return;
    setSavingAffiliate(true);
    try {
      await fetch('/api/thread-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: affiliateModalPost.id, affiliateComment: affiliateDraft }),
      });
      setAffiliateModalPost(null);
      loadPosts();
    } finally {
      setSavingAffiliate(false);
    }
  }

  async function handlePublish(postId: string) {
    const accountId = publishAccount[postId] || accounts[0]?.id;
    if (!accountId) return;
    setPublishing(postId);
    try {
      const res = await fetch('/api/threads-accounts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, threadsAccountId: accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발행 실패');
      loadPosts();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(null);
    }
  }

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
              {p.affiliate_comment && (
                <div className="text-xs bg-neutral-50 border border-border p-2 mb-3">
                  <span className="font-bold text-neutral-500">💰 제휴 타래(2번째 댓글): </span>
                  {p.affiliate_comment}
                </div>
              )}
              {p.status === 'posted' ? (
                <span className="text-[11px] font-black text-emerald-600">✔ 발행 완료</span>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => openAffiliateModal(p)} className="text-[11px] font-black border border-border px-4 py-2">
                    💰 제휴 타래 {p.affiliate_comment ? '수정' : '추가'}
                  </button>
                  {accounts.length === 0 ? (
                    <button disabled className="text-[11px] font-black text-neutral-300 border border-border px-4 py-2 cursor-not-allowed">
                      쓰레드에 발행 (<Link href="/dashboard/threads-manage" className="underline">계정 연동 필요</Link>)
                    </button>
                  ) : (
                    <>
                      {accounts.length > 1 && (
                        <select
                          value={publishAccount[p.id] || accounts[0].id}
                          onChange={(e) => setPublishAccount((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="border border-border text-xs px-2 py-2"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>@{a.username || a.threads_user_id}</option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => handlePublish(p.id)}
                        disabled={publishing === p.id}
                        className="text-[11px] font-black text-white bg-black px-4 py-2"
                      >
                        {publishing === p.id ? '발행 중...' : '쓰레드에 발행'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {affiliateModalPost && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setAffiliateModalPost(null)}>
          <div className="bg-white p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-1">💰 제휴 타래 추가</h2>
            <p className="text-xs text-neutral-400 mb-4">발행 시 본문 게시물에 대한 답글(2번째 타래)로 자동으로 이어서 발행돼요.</p>

            {affiliateTemplates.length > 0 && (
              <select
                onChange={(e) => e.target.value && setAffiliateDraft(e.target.value)}
                className="w-full border border-border px-3 py-2.5 text-sm mb-3"
                defaultValue=""
              >
                <option value="">템플릿 불러오기...</option>
                {affiliateTemplates.map((t) => (
                  <option key={t.id} value={t.body}>{t.name || t.body}</option>
                ))}
              </select>
            )}

            <div className="text-[11px] text-neutral-400 mb-2">💡 클릭하여 커서 위치에 변수 삽입:</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {VARIABLES.map((v) => (
                <button key={v} onClick={() => setAffiliateDraft((prev) => prev + v)} className="text-[11px] bg-neutral-100 px-2 py-1 font-bold">
                  {v}
                </button>
              ))}
            </div>

            <textarea
              value={affiliateDraft}
              onChange={(e) => setAffiliateDraft(e.target.value)}
              placeholder="예: 너무 많이 물어봐서 아래 링크 달게\n\n링크 : [제휴링크]"
              rows={4}
              className="w-full border border-border px-3 py-2.5 text-sm mb-4"
            />

            <div className="flex gap-2">
              <button onClick={() => setAffiliateModalPost(null)} className="flex-1 border border-border text-[11px] font-black py-3">취소</button>
              <button onClick={saveAffiliateComment} disabled={savingAffiliate} className="flex-1 bg-black text-white text-[11px] font-black py-3">
                {savingAffiliate ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SmartEditorPage() {
  return (
    <div>
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
