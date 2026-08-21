'use client';

import { useEffect, useState } from 'react';
import { PremiumGate } from '../PremiumLock';

type Persona = { id: string; name: string; tone_prompt: string; target_prompt: string };

function PersonaManager() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [name, setName] = useState('');
  const [tonePrompt, setTonePrompt] = useState('');
  const [targetPrompt, setTargetPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    fetch('/api/personas')
      .then((r) => r.json())
      .then((d) => setPersonas(d.personas || []));
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
        body: JSON.stringify({ name, tonePrompt, targetPrompt }),
      });
      setName('');
      setTonePrompt('');
      setTargetPrompt('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/personas?id=${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="border border-border p-6 mb-6 max-w-lg">
        <h2 className="font-black text-sm mb-4">새 페르소나 만들기</h2>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="페르소나 이름 (예: 발랄한 마케터)" className="w-full border border-border px-3 py-2.5 text-sm" />
          <textarea value={tonePrompt} onChange={(e) => setTonePrompt(e.target.value)} placeholder="말투 프롬프트 (예: 반말, 이모지 자주 사용, 짧고 임팩트있게)" rows={2} className="w-full border border-border px-3 py-2.5 text-sm" />
          <textarea value={targetPrompt} onChange={(e) => setTargetPrompt(e.target.value)} placeholder="타겟팅 프롬프트 (예: 20대 초반 마케팅 취준생)" rows={2} className="w-full border border-border px-3 py-2.5 text-sm" />
          <button onClick={handleCreate} disabled={saving} className="w-full bg-black text-white text-[11px] font-black py-3">
            {saving ? '저장 중...' : '페르소나 추가'}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {personas.map((p) => (
          <div key={p.id} className="border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black">{p.name}</h3>
              <button onClick={() => handleDelete(p.id)} className="text-xs text-red-500">삭제</button>
            </div>
            {p.tone_prompt && <div className="text-xs text-neutral-500 mb-1">말투: {p.tone_prompt}</div>}
            {p.target_prompt && <div className="text-xs text-neutral-500">타겟: {p.target_prompt}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PersonasPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">페르소나 관리</h1>
      </div>
      <PremiumGate message="나만의 고유한 말투, 타겟팅 프롬프트, AI 페르소나 설정 및 프로필 분석 추출 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다.">
        <PersonaManager />
      </PremiumGate>
    </div>
  );
}
