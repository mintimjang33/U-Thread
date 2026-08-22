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
  scheduled_at: string | null;
  publish_error: string | null;
};
type ThreadsAccount = { id: string; username: string | null; threads_user_id: string };
type AffiliateTemplate = { id: string; name: string; body: string };
type SystemPersona = { id: string; name: string };
type CoupangProduct = { productId: number; productName: string; productPrice: number; productImage: string; productUrl: string };

const VARIABLES = ['[제품명]', '[제휴링크]', '[가격]', '[혜택]', '[심의문구]'];

const COMPLIANCE_CATEGORIES = [
  { value: '', label: '-- 분류 선택 --' },
  { value: '의료', label: '의료법 / 병원' },
  { value: '의약품', label: '의약품' },
  { value: '의료기기', label: '의료기기' },
  { value: '건기식', label: '건강기능식품' },
  { value: '특수식품', label: '특수용도식품' },
  { value: '금융', label: '금융투자상품' },
  { value: '보험', label: '보험상품' },
  { value: '대부', label: '대부업' },
];

const RESULT_STYLES = [
  { key: 'basic', icon: '💡', label: '추천 기본 (기본기 충실)' },
  { key: 'hook', icon: '🔥', label: '검색/뷰 최적화 (어그로/훅)' },
  { key: 'persona', icon: '🎭', label: '내 페르소나 (커스텀 톤)' },
] as const;

function SmartEditor() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [systemPersonas, setSystemPersonas] = useState<SystemPersona[]>([]);
  const [personaKey, setPersonaKey] = useState(''); // "sys:id" | "own:id" | ""
  const [topic, setTopic] = useState('');
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [publishAccount, setPublishAccount] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topTab, setTopTab] = useState<'draft' | 'affiliate' | 'compliance'>('draft');
  const [affiliateSubTab, setAffiliateSubTab] = useState<'coupang' | 'toss' | 'generic'>('coupang');
  const [complianceCategory, setComplianceCategory] = useState('');

  const [coupangKeyword, setCoupangKeyword] = useState('');
  const [coupangResults, setCoupangResults] = useState<CoupangProduct[]>([]);
  const [coupangSearching, setCoupangSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CoupangProduct | null>(null);

  const [affiliateProductName, setAffiliateProductName] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');

  const [affiliateTemplates, setAffiliateTemplates] = useState<AffiliateTemplate[]>([]);
  const [affiliateModalPost, setAffiliateModalPost] = useState<ThreadPost | null>(null);
  const [affiliateDraft, setAffiliateDraft] = useState('');
  const [savingAffiliate, setSavingAffiliate] = useState(false);

  const [scheduleModalPost, setScheduleModalPost] = useState<ThreadPost | null>(null);
  const [scheduleAccountId, setScheduleAccountId] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduling, setScheduling] = useState(false);

  function loadPosts() {
    fetch('/api/smart-editor')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []));
  }

  useEffect(() => {
    fetch('/api/personas')
      .then((r) => r.json())
      .then((d) => setPersonas(d.personas || []));
    fetch('/api/personas/system')
      .then((r) => r.json())
      .then((d) => setSystemPersonas(d.systemPersonas || []));
    fetch('/api/threads-accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []));
    fetch('/api/affiliate-templates')
      .then((r) => r.json())
      .then((d) => setAffiliateTemplates([...(d.systemTemplates || []), ...(d.templates || [])]));
    loadPosts();
  }, []);

  async function handleCoupangSearch() {
    if (!coupangKeyword.trim()) return;
    setCoupangSearching(true);
    try {
      const res = await fetch(`/api/coupang/search?keyword=${encodeURIComponent(coupangKeyword)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '검색 실패');
      setCoupangResults(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCoupangSearching(false);
    }
  }

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

  function openScheduleModal(post: ThreadPost) {
    setScheduleModalPost(post);
    setScheduleAccountId(publishAccount[post.id] || accounts[0]?.id || '');
    setScheduleAt('');
  }

  async function handleSchedule() {
    if (!scheduleModalPost || !scheduleAccountId || !scheduleAt) return;
    setScheduling(true);
    try {
      const res = await fetch('/api/thread-posts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: scheduleModalPost.id,
          scheduledAt: new Date(scheduleAt).toISOString(),
          threadsAccountId: scheduleAccountId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '예약 실패');
      setScheduleModalPost(null);
      loadPosts();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScheduling(false);
    }
  }

  async function handleCancelSchedule(postId: string) {
    await fetch(`/api/thread-posts/schedule?postId=${postId}`, { method: 'DELETE' });
    loadPosts();
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

  const [scope, personaId] = personaKey.split(':');
  const canGenerate =
    topTab === 'draft'
      ? !!topic.trim()
      : topTab === 'compliance'
        ? !!topic.trim() && !!complianceCategory
        : affiliateSubTab === 'coupang'
          ? !!selectedProduct
          : affiliateSubTab === 'generic'
            ? !!affiliateUrl.trim()
            : false; // toss: 실 API 미연동

  async function handleGenerate(resultStyle: 'basic' | 'hook' | 'persona') {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        topic: topic || undefined,
        personaId: personaId || undefined,
        personaIsSystem: scope === 'sys',
        resultStyle,
      };
      if (topTab === 'compliance') body.complianceCategory = complianceCategory;
      if (topTab === 'affiliate' && affiliateSubTab === 'coupang' && selectedProduct) body.product = selectedProduct;
      if (topTab === 'affiliate' && affiliateSubTab === 'generic') {
        body.affiliateUrl = affiliateUrl;
        body.affiliateProductName = affiliateProductName;
      }

      const res = await fetch('/api/smart-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setTopic('');
      setSelectedProduct(null);
      setAffiliateUrl('');
      setAffiliateProductName('');
      loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="border border-border mb-6">
        <div className="flex border-b border-border">
          {([
            ['draft', '원고 작성'],
            ['affiliate', '제휴 마케팅'],
            ['compliance', '심의 필고'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTopTab(key)}
              className={`flex-1 py-3 text-xs font-black ${topTab === key ? 'bg-black text-white' : 'text-neutral-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {topTab === 'affiliate' && (
            <div className="flex gap-2 mb-4">
              {([
                ['coupang', '쿠팡 파트너스'],
                ['toss', '토스쇼핑'],
                ['generic', '제휴마케팅'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setAffiliateSubTab(key)}
                  className={`px-3 py-1.5 text-[11px] font-bold border ${affiliateSubTab === key ? 'border-black bg-neutral-50' : 'border-border text-neutral-400'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {topTab === 'draft' && (
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="어떤 주제로 글을 쓸까요? (예: 아침 루틴 바꾸고 생긴 변화)"
              rows={3}
              className="w-full border border-border px-3 py-2.5 text-sm mb-3"
            />
          )}

          {topTab === 'compliance' && (
            <div className="mb-3">
              <label className="text-xs font-bold text-neutral-500 mb-1 block">작성 주제 (제품명/서비스명)</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 튼튼 홍삼정"
                className="w-full border border-border px-3 py-2.5 text-sm mb-3"
              />
              <label className="text-xs font-bold text-neutral-500 mb-1 block">심의필 카테고리 규정</label>
              <select
                value={complianceCategory}
                onChange={(e) => setComplianceCategory(e.target.value)}
                className="w-full border border-border px-3 py-2.5 text-sm"
              >
                {COMPLIANCE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-neutral-400 mt-1">
                선택한 업종의 광고 표현 규정을 참고해 문구를 순화해서 생성해요 (참고용이며 실제 법률 검토를 대체하지 않아요).
              </p>
            </div>
          )}

          {topTab === 'affiliate' && affiliateSubTab === 'coupang' && (
            <div className="mb-3">
              <div className="flex gap-2 mb-3">
                <input
                  value={coupangKeyword}
                  onChange={(e) => setCoupangKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCoupangSearch()}
                  placeholder="상품 키워드 (예: 무선 청소기)"
                  className="flex-1 border border-border px-3 py-2 text-sm"
                />
                <button onClick={handleCoupangSearch} disabled={coupangSearching} className="bg-black text-white text-xs font-black px-4">
                  {coupangSearching ? '검색 중...' : '검색'}
                </button>
              </div>
              {selectedProduct && (
                <div className="flex items-center gap-2 bg-neutral-50 border border-border p-2 mb-3 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedProduct.productImage} alt="" className="w-10 h-10 object-cover" />
                  <span className="flex-1 font-bold">{selectedProduct.productName}</span>
                  <span>{selectedProduct.productPrice.toLocaleString()}원</span>
                  <button onClick={() => setSelectedProduct(null)} className="text-red-500 font-bold">선택 해제</button>
                </div>
              )}
              {coupangResults.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-3">
                  {coupangResults.map((p) => (
                    <button
                      key={p.productId}
                      onClick={() => setSelectedProduct(p)}
                      className={`border p-2 text-left text-[11px] ${selectedProduct?.productId === p.productId ? 'border-black' : 'border-border'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.productImage} alt="" className="w-full aspect-square object-cover mb-1" />
                      <div className="line-clamp-2 font-bold">{p.productName}</div>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="추가 강조할 내용 (선택 - 비워두면 상품 정보로 AI가 자동 작성)"
                rows={2}
                className="w-full border border-border px-3 py-2.5 text-sm"
              />
            </div>
          )}

          {topTab === 'affiliate' && affiliateSubTab === 'toss' && (
            <div className="border border-dashed border-border p-8 text-center text-xs text-neutral-400 mb-3">
              토스쇼핑 상품 카탈로그 API 연동은 준비 중이에요.
            </div>
          )}

          {topTab === 'affiliate' && affiliateSubTab === 'generic' && (
            <div className="mb-3 space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-500 mb-1 block">제품명</label>
                <input
                  value={affiliateProductName}
                  onChange={(e) => setAffiliateProductName(e.target.value)}
                  placeholder="예: 샤오미 미밴드 8"
                  className="w-full border border-border px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-500 mb-1 block">쇼핑몰 상품 URL</label>
                <input
                  value={affiliateUrl}
                  onChange={(e) => setAffiliateUrl(e.target.value)}
                  placeholder="https://link.coupang.com/a/... 또는 https://..."
                  className="w-full border border-border px-3 py-2.5 text-sm"
                />
              </div>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="추가 설명 (선택)"
                rows={2}
                className="w-full border border-border px-3 py-2.5 text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-neutral-500 mb-1 block">페르소나 픽</label>
              <select value={personaKey} onChange={(e) => setPersonaKey(e.target.value)} className="w-full border border-border px-3 py-2.5 text-sm">
                <option value="">-- 시스템 기본 --</option>
                {systemPersonas.map((p) => (
                  <option key={p.id} value={`sys:${p.id}`}>{p.name}</option>
                ))}
                {personas.map((p) => (
                  <option key={p.id} value={`own:${p.id}`}>{p.name}</option>
                ))}
              </select>
              {personas.length === 0 && (
                <div className="text-[10px] text-neutral-400 mt-1">
                  나만의 페르소나는 <Link href="/dashboard/personas" className="underline font-bold text-black">페르소나 관리</Link>에서 만들 수 있어요.
                </div>
              )}
            </div>
          </div>

          {error && <div className="text-xs text-red-500 mb-3">{error}</div>}

          <div className="text-xs font-bold text-neutral-500 mb-2">결과 스타일을 선택하면 바로 생성이 시작돼요</div>
          <div className="grid grid-cols-3 gap-2">
            {RESULT_STYLES.map((s) => (
              <button
                key={s.key}
                onClick={() => handleGenerate(s.key)}
                disabled={!canGenerate || generating}
                className={`text-[11px] font-black py-3 ${!canGenerate ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed' : 'bg-black text-white'}`}
              >
                {generating ? '생성 중...' : `${s.icon} ${s.label}`}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-neutral-400 mt-2">
            Gemini API 키가 필요해요 (<Link href="/onboarding" className="underline">등록하러 가기</Link>)
          </div>
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
              {p.status === 'posted' && <span className="text-[11px] font-black text-emerald-600">✔ 발행 완료</span>}
              {p.status === 'publishing' && <span className="text-[11px] font-black text-amber-600">발행 중...</span>}
              {p.status === 'scheduled' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black text-blue-600">
                    ⏰ {p.scheduled_at && new Date(p.scheduled_at).toLocaleString('ko-KR')} 예약됨
                  </span>
                  <button onClick={() => handleCancelSchedule(p.id)} className="text-[11px] font-bold text-red-500 border border-border px-3 py-1.5">
                    예약 취소
                  </button>
                </div>
              )}
              {(p.status === 'draft' || p.status === 'failed') && (
                <div className="flex flex-col gap-2">
                  {p.status === 'failed' && p.publish_error && (
                    <div className="text-xs text-red-500">✕ 발행 실패: {p.publish_error}</div>
                  )}
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
                          {publishing === p.id ? '발행 중...' : '지금 발행'}
                        </button>
                        <button onClick={() => openScheduleModal(p)} className="text-[11px] font-black border border-border px-4 py-2">
                          ⏰ 예약 발행
                        </button>
                      </>
                    )}
                  </div>
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

      {scheduleModalPost && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setScheduleModalPost(null)}>
          <div className="bg-white p-8 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">⏰ 예약 발행</h2>
            <label className="text-xs font-bold text-neutral-500 mb-1 block">발행 계정</label>
            <select
              value={scheduleAccountId}
              onChange={(e) => setScheduleAccountId(e.target.value)}
              className="w-full border border-border px-3 py-2.5 text-sm mb-3"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>@{a.username || a.threads_user_id}</option>
              ))}
            </select>
            <label className="text-xs font-bold text-neutral-500 mb-1 block">예약 발행 시각</label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              className="w-full border border-border px-3 py-2.5 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setScheduleModalPost(null)} className="flex-1 border border-border text-[11px] font-black py-3">취소</button>
              <button
                onClick={handleSchedule}
                disabled={scheduling || !scheduleAccountId || !scheduleAt}
                className="flex-1 bg-black text-white text-[11px] font-black py-3"
              >
                {scheduling ? '예약 중...' : '예약하기'}
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
