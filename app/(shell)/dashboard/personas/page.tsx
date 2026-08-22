'use client';

import { useEffect, useState } from 'react';

type Persona = { id: string; name: string; tone_prompt: string; target_prompt: string };
type SystemPersona = { id: string; name: string; prompt: string };
type AffiliateTemplate = { id: string; name: string; body: string; is_system?: boolean };
type EditorDefaults = {
  default_persona_id: string | null;
  default_persona_is_system: boolean;
  default_affiliate_template_id: string | null;
};

function PersonaTab() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [systemPersonas, setSystemPersonas] = useState<SystemPersona[]>([]);
  const [defaults, setDefaults] = useState<EditorDefaults | null>(null);

  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleHandle, setRoleHandle] = useState('');
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [benchmarkItems, setBenchmarkItems] = useState<{ id: string; source: string; content: string }[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  function load() {
    fetch('/api/personas').then((r) => r.json()).then((d) => setPersonas(d.personas || []));
    fetch('/api/personas/system').then((r) => r.json()).then((d) => setSystemPersonas(d.systemPersonas || []));
    fetch('/api/editor-defaults').then((r) => r.json()).then((d) => setDefaults(d.defaults));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tonePrompt: prompt }),
      });
      setName('');
      setPrompt('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/personas?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function handleSetDefault(id: string, isSystem: boolean) {
    await fetch('/api/editor-defaults', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_persona_id: id, default_persona_is_system: isSystem }),
    });
    load();
  }

  async function handleExtractFromProfile() {
    if (!roleHandle.trim()) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch('/api/personas/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'profile', handle: roleHandle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '추출 실패');
      setName(data.name);
      setPrompt(data.prompt);
      setShowRoleModal(false);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  }

  async function openBenchmarkModal() {
    setShowBenchmarkModal(true);
    const d = await fetch('/api/benchmark').then((r) => r.json());
    setBenchmarkItems(d.items || []);
  }

  async function handleExtractFromBenchmark(itemId: string) {
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch('/api/personas/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'benchmark', benchmarkItemId: itemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '추출 실패');
      setName(data.name);
      setPrompt(data.prompt);
      setShowBenchmarkModal(false);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[380px_1fr] gap-6">
      <div className="border border-border p-6 h-fit">
        <h2 className="font-black text-sm mb-1">✨ 새 페르소나 생성</h2>
        <p className="text-xs text-neutral-400 mb-4">나만의 말투, 어조, 지침을 등록하여 일관된 개성의 글을 생성하세요.</p>

        <div className="text-xs font-bold text-neutral-500 mb-2">AI 스타일 자동 추출 도구</div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setShowRoleModal(true)} className="flex-1 border border-border px-2 py-2 text-[11px] font-bold">
            🔍 롤모델 계정 검색
          </button>
          <button onClick={openBenchmarkModal} className="flex-1 border border-border px-2 py-2 text-[11px] font-bold">
            📁 벤치마킹에서 추출
          </button>
        </div>
        {extractError && <div className="text-xs text-red-500 mb-3">{extractError}</div>}

        <label className="text-xs font-bold text-neutral-500 mb-1 block">페르소나 이름</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 팩트 중심 테크 칼럼니스트" className="w-full border border-border px-3 py-2.5 text-sm mb-3" />
        <label className="text-xs font-bold text-neutral-500 mb-1 block">페르소나 스타일 및 프롬프트 지침</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="예: 간결하고 군더더기 없는 문체. 핵심 수치와 비교표를 선호하며 유머러스한 비유를 섞어 설명함..."
          rows={6}
          className="w-full border border-border px-3 py-2.5 text-sm mb-4"
        />
        <button onClick={handleCreate} disabled={saving} className="w-full bg-accent text-white text-[11px] font-black py-3">
          {saving ? '저장 중...' : '페르소나 추가'}
        </button>
      </div>

      <div>
        <h2 className="font-black text-sm mb-4">등록된 페르소나 ({systemPersonas.length + personas.length}개)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {systemPersonas.map((p) => {
            const isDefault = defaults?.default_persona_is_system && defaults?.default_persona_id === p.id;
            return (
              <div key={p.id} className={`border p-4 ${isDefault ? 'border-black bg-neutral-50' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-black text-sm">{p.name}</h3>
                  <span className="text-[10px] bg-neutral-200 text-neutral-600 font-bold px-2 py-0.5">시스템</span>
                </div>
                <p className="text-xs text-neutral-500 mb-3 line-clamp-4">{p.prompt}</p>
                <div className="flex items-center justify-between text-[11px]">
                  {isDefault ? (
                    <span className="font-bold">★ 기본 페르소나</span>
                  ) : (
                    <button onClick={() => handleSetDefault(p.id, true)} className="text-neutral-400 font-bold">
                      ☆ 기본으로 설정
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {personas.map((p) => {
            const isDefault = !defaults?.default_persona_is_system && defaults?.default_persona_id === p.id;
            return (
              <div key={p.id} className={`border p-4 ${isDefault ? 'border-black bg-neutral-50' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-black text-sm">{p.name}</h3>
                  <button onClick={() => handleDelete(p.id)} className="text-xs text-red-500">삭제</button>
                </div>
                {p.tone_prompt && <p className="text-xs text-neutral-500 mb-3 line-clamp-4">{p.tone_prompt}</p>}
                <div className="flex items-center justify-between text-[11px]">
                  {isDefault ? (
                    <span className="font-bold">★ 기본 페르소나</span>
                  ) : (
                    <button onClick={() => handleSetDefault(p.id, false)} className="text-neutral-400 font-bold">
                      ☆ 기본으로 설정
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showRoleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowRoleModal(false)}>
          <div className="bg-white p-8 max-w-md w-full rounded-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">🔍 롤모델 계정 검색</h2>
            <input
              value={roleHandle}
              onChange={(e) => setRoleHandle(e.target.value)}
              placeholder="@handle (Threads 공개 계정)"
              className="w-full border border-border px-3 py-2.5 text-sm mb-4"
            />
            <p className="text-[11px] text-neutral-400 mb-4">공개 프로필에서 가져올 수 있는 정보(소개글)만으로 스타일을 분석해요. 정보가 부족하면 실패할 수 있어요 — 그럴 땐 벤치마킹에서 추출을 이용해주세요.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowRoleModal(false)} className="flex-1 border border-border text-[11px] font-black py-3">취소</button>
              <button onClick={handleExtractFromProfile} disabled={extracting} className="flex-1 bg-accent text-white text-[11px] font-black py-3">
                {extracting ? '분석 중...' : '스타일 추출'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBenchmarkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowBenchmarkModal(false)}>
          <div className="bg-white p-8 max-w-md w-full max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">📁 벤치마킹에서 추출</h2>
            {benchmarkItems.length === 0 ? (
              <div className="text-xs text-neutral-400 text-center py-6">보관함에 저장된 글이 없어요.</div>
            ) : (
              <div className="space-y-2">
                {benchmarkItems.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => handleExtractFromBenchmark(it.id)}
                    disabled={extracting}
                    className="w-full text-left border border-border p-3 text-xs hover:bg-neutral-50"
                  >
                    {it.source && <div className="font-bold text-neutral-500 mb-1">{it.source}</div>}
                    <div className="line-clamp-2">{it.content}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const VARIABLES = ['[제품명]', '[제휴링크]', '[가격]', '[혜택]', '[심의문구]'];

function AffiliateTemplateTab() {
  const [systemTemplates, setSystemTemplates] = useState<AffiliateTemplate[]>([]);
  const [templates, setTemplates] = useState<AffiliateTemplate[]>([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    fetch('/api/affiliate-templates')
      .then((r) => r.json())
      .then((d) => {
        setSystemTemplates(d.systemTemplates || []);
        setTemplates(d.templates || []);
      });
  }

  useEffect(() => {
    load();
  }, []);

  function insertVariable(v: string) {
    setBody((prev) => prev + v);
  }

  async function handleSave() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/affiliate-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body }),
      });
      setName('');
      setBody('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/affiliate-templates?id=${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-6">
      <div className="border border-border p-6 h-fit">
        <h2 className="font-black text-sm mb-1">💬 제휴 댓글 템플릿 관리</h2>
        <p className="text-xs text-neutral-400 mb-4">
          스마트 에디터의 [제휴 타래 추가]에서 원클릭으로 불러올 수 있는 제휴 링크 및 심의문구 템플릿을 등록하고 관리합니다.
        </p>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="템플릿 이름 (선택)" className="w-full border border-border px-3 py-2.5 text-sm mb-3" />

        <div className="text-[11px] text-neutral-400 mb-2">💡 클릭하여 커서 위치에 변수 삽입:</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {VARIABLES.map((v) => (
            <button key={v} onClick={() => insertVariable(v)} className="text-[11px] bg-neutral-100 px-2 py-1 font-bold">
              {v}
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="댓글 템플릿 본문"
          rows={4}
          className="w-full border border-border px-3 py-2.5 text-sm mb-3"
        />
        <button onClick={handleSave} disabled={saving} className="w-full bg-accent text-white text-[11px] font-black py-3 mb-6">
          💾 나만의 제휴 템플릿으로 저장
        </button>

        <div className="text-xs font-bold mb-2">📱 실시간 댓글 렌더링 미리보기</div>
        <div className="border border-border p-4">
          <div className="text-[11px] text-neutral-400 mb-2">실제 발행 시 모습</div>
          <div className="border border-border p-3 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[10px]">@</span>
              <span className="font-bold">내 쓰레드 계정 (1번째 타래 댓글)</span>
            </div>
            <div className="text-neutral-400 mb-2">방금 전 · Threads Reply</div>
            <p className="text-neutral-500 mb-2">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
            <p className="whitespace-pre-wrap mb-2">{body || '댓글 템플릿 본문을 입력하면 여기 미리보기가 표시돼요.'}</p>
            <p className="text-blue-600">링크 : https://link.coupang.com/a/sample-affiliate-link</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-black text-sm mb-4">시스템 기본 템플릿</h2>
        <div className="grid gap-3 mb-8">
          {systemTemplates.map((t) => (
            <div key={t.id} className="border border-border p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] bg-neutral-200 text-neutral-600 font-bold px-2 py-0.5 inline-block mb-1">시스템</div>
                <div className="text-sm">{t.body}</div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="font-black text-sm mb-4">나만의 템플릿</h2>
        {templates.length === 0 ? (
          <div className="text-xs text-neutral-400">아직 만든 템플릿이 없어요.</div>
        ) : (
          <div className="grid gap-3">
            {templates.map((t) => (
              <div key={t.id} className="border border-border p-4 flex items-center justify-between">
                <div>
                  {t.name && <div className="text-xs font-bold text-neutral-500 mb-1">{t.name}</div>}
                  <div className="text-sm">{t.body}</div>
                </div>
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red-500">삭제</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PersonasPage() {
  const [tab, setTab] = useState<'persona' | 'affiliate'>('persona');

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-accent inline-block" />
        <h1 className="text-xl font-black">페르소나 관리</h1>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setTab('persona')}
          className={`px-4 py-2.5 text-xs font-black border-b-2 ${tab === 'persona' ? 'border-black' : 'border-transparent text-neutral-400'}`}
        >
          작성 페르소나 관리
        </button>
        <button
          onClick={() => setTab('affiliate')}
          className={`px-4 py-2.5 text-xs font-black border-b-2 ${tab === 'affiliate' ? 'border-black' : 'border-transparent text-neutral-400'}`}
        >
          제휴 댓글 템플릿
        </button>
      </div>

      {tab === 'persona' ? <PersonaTab /> : <AffiliateTemplateTab />}
    </div>
  );
}
