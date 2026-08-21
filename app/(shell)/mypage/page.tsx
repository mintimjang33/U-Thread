'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '../../../lib/supabaseBrowser';

const TABS = ['계정 설정', 'AI 설정', '글양식 설정', '쓰레드 설정', '제휴 설정', '구독 관리'] as const;
type Tab = (typeof TABS)[number];

function AccountTab() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, password: password || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');
      setMsg('저장했어요.');
      setPassword('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoutAll() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: 'global' });
    window.location.href = '/';
  }

  return (
    <div className="max-w-lg">
      <div className="border border-border p-6 mb-6">
        <h2 className="font-black text-sm mb-1">👤 계정 기본 정보 변경</h2>
        <p className="text-xs text-neutral-400 mb-4">서비스 내에서 표시되는 사용자 이름, 회사명 및 비밀번호를 관리합니다.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-bold text-neutral-500 mb-1 block">이름 (닉네임)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-border px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-500 mb-1 block">회사명 / 소속</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full border border-border px-3 py-2.5 text-sm" />
          </div>
        </div>
        <label className="text-xs font-bold text-neutral-500 mb-1 block">새 비밀번호 교체</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="변경하지 않으려면 비워두세요" className="w-full border border-border px-3 py-2.5 text-sm mb-3" />
        {msg && <div className="text-xs text-neutral-500 mb-3">{msg}</div>}
        <button onClick={handleSave} disabled={saving} className="w-full bg-black text-white text-[11px] font-black py-3">
          {saving ? '저장 중...' : '수정 사항 저장하기'}
        </button>
      </div>

      <button onClick={handleLogoutAll} className="w-full border border-border text-[11px] font-black py-3">
        모든 세션 로그아웃
      </button>
    </div>
  );
}

function AiSettingsTab() {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    fetch('/api/keys?provider=GEMINI').then((r) => r.json()).then((d) => setHasKey(!!d.hasKey));
  }, []);

  return (
    <div className="max-w-lg border border-border p-6">
      <h2 className="font-black text-sm mb-1">🤖 AI 엔진 및 키 볼트 설정</h2>
      <p className="text-xs text-neutral-400 mb-4">AI 프로바이더 및 개인 API 키 커스텀 볼트 연동. 유쓰레드는 이 기능을 무료로 제공합니다.</p>
      <div className="flex items-center justify-between border border-border p-4">
        <div>
          <div className="text-sm font-bold">Google Gemini API 키</div>
          <div className={`text-xs mt-1 ${hasKey ? 'text-emerald-600' : 'text-red-500'}`}>{hasKey ? '● 연동됨' : '● 미연동 상태'}</div>
        </div>
        <Link href="/onboarding" className="bg-black text-white text-[11px] font-black px-4 py-2.5">
          {hasKey ? '키 재설정' : '키 등록하기'}
        </Link>
      </div>
    </div>
  );
}

type SystemPersona = { id: string; name: string };
type Persona = { id: string; name: string };
type AffiliateTemplate = { id: string; name: string; body: string };

function EditorFormatTab() {
  const [systemPersonas, setSystemPersonas] = useState<SystemPersona[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<AffiliateTemplate[]>([]);
  const [templates, setTemplates] = useState<AffiliateTemplate[]>([]);

  const [visionAnalysis, setVisionAnalysis] = useState(true);
  const [googleSearch, setGoogleSearch] = useState(true);
  const [threadSegments, setThreadSegments] = useState(1);
  const [relayDelay, setRelayDelay] = useState(false);
  const [defaultPersonaKey, setDefaultPersonaKey] = useState('');
  const [defaultTemplateId, setDefaultTemplateId] = useState('');
  const [coupangAutoImage, setCoupangAutoImage] = useState(true);
  const [tossAutoImage, setTossAutoImage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/personas/system').then((r) => r.json()).then((d) => setSystemPersonas(d.systemPersonas || []));
    fetch('/api/personas').then((r) => r.json()).then((d) => setPersonas(d.personas || []));
    fetch('/api/affiliate-templates').then((r) => r.json()).then((d) => {
      setSystemTemplates(d.systemTemplates || []);
      setTemplates(d.templates || []);
    });
    fetch('/api/editor-defaults').then((r) => r.json()).then((d) => {
      const def = d.defaults;
      if (!def) return;
      setVisionAnalysis(def.vision_analysis);
      setGoogleSearch(def.google_search);
      setThreadSegments(def.thread_segments);
      setRelayDelay(def.relay_delay);
      setCoupangAutoImage(def.coupang_auto_image);
      setTossAutoImage(def.toss_auto_image);
      setDefaultTemplateId(def.default_affiliate_template_id || '');
      if (def.default_persona_id) {
        setDefaultPersonaKey(`${def.default_persona_is_system ? 'sys' : 'own'}:${def.default_persona_id}`);
      }
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const [scope, id] = defaultPersonaKey.split(':');
    try {
      await fetch('/api/editor-defaults', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vision_analysis: visionAnalysis,
          google_search: googleSearch,
          thread_segments: threadSegments,
          relay_delay: relayDelay,
          default_persona_id: id || null,
          default_persona_is_system: scope === 'sys',
          default_affiliate_template_id: defaultTemplateId || null,
          coupang_auto_image: coupangAutoImage,
          toss_auto_image: tossAutoImage,
        }),
      });
      setMsg('저장했어요. (DB에 동기화되어 에디터 기본값에 적용돼요)');
    } finally {
      setSaving(false);
    }
  }

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`w-9 h-5 rounded-full relative flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-neutral-300'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-4.5' : 'left-0.5'}`} />
    </button>
  );

  return (
    <div className="max-w-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-black text-sm">✍️ 글양식 기본 설정</h2>
        <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-1">DB 영구 동기화</span>
      </div>
      <p className="text-xs text-neutral-400 mb-6">에디터에서 글 작성 시 기본으로 적용될 AI 분석 옵션, 기본 타래 갯수, 기본 페르소나 및 제휴 템플릿을 설정합니다.</p>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-black">📸 첨부 미디어 AI 비전 분석</div>
            <div className="text-[10px] text-neutral-400">글 작성 시 업로드된 사진/동영상을 AI가 자동 분석하여 본문에 반영합니다.</div>
          </div>
          <Toggle on={visionAnalysis} onClick={() => setVisionAnalysis((v) => !v)} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-black">🔍 실시간 구글 검색 활용</div>
            <div className="text-[10px] text-neutral-400">최신 시사·가격·트렌드 팩트 체크를 위해 실시간 검색을 활용합니다.</div>
          </div>
          <Toggle on={googleSearch} onClick={() => setGoogleSearch((v) => !v)} />
        </div>
        <div>
          <div className="text-xs font-black mb-2">🧵 기본 생성할 타래 갯수 (1개~10개)</div>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setThreadSegments(n)}
                className={`w-8 h-8 text-[11px] font-bold ${threadSegments === n ? 'bg-black text-white' : 'border border-border text-neutral-400'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-black">⏱️ 타래별 시간차 지연 발행 (릴레이 간격)</div>
            <div className="text-[10px] text-neutral-400">봇 감지 방지 및 도달률 향상을 위해 순차 발행 간격을 둡니다.</div>
          </div>
          <Toggle on={relayDelay} onClick={() => setRelayDelay((v) => !v)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-black">🎭 기본 페르소나</div>
            <Link href="/dashboard/personas" className="text-[10px] text-neutral-400">관리 페이지 이동</Link>
          </div>
          <select value={defaultPersonaKey} onChange={(e) => setDefaultPersonaKey(e.target.value)} className="w-full border border-border px-3 py-2.5 text-sm">
            <option value="">선택 안 함</option>
            {systemPersonas.map((p) => (
              <option key={p.id} value={`sys:${p.id}`}>[시스템] {p.name}</option>
            ))}
            {personas.map((p) => (
              <option key={p.id} value={`own:${p.id}`}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-black">💬 기본 고정 제휴 댓글</div>
            <Link href="/dashboard/personas" className="text-[10px] text-neutral-400">관리 페이지 이동</Link>
          </div>
          <select value={defaultTemplateId} onChange={(e) => setDefaultTemplateId(e.target.value)} className="w-full border border-border px-3 py-2.5 text-sm">
            <option value="">선택 안 함</option>
            {systemTemplates.map((t) => (
              <option key={t.id} value={t.id}>[시스템] {t.body}</option>
            ))}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name || t.body}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs font-black">📦 쿠팡 파트너스 상품 이미지 자동 첨부</div>
          <Toggle on={coupangAutoImage} onClick={() => setCoupangAutoImage((v) => !v)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs font-black">🛒 토스 쇼핑 상품 이미지 자동 첨부</div>
          <Toggle on={tossAutoImage} onClick={() => setTossAutoImage((v) => !v)} />
        </div>
      </div>

      {msg && <div className="text-xs text-neutral-500 mt-4">{msg}</div>}
      <button onClick={handleSave} disabled={saving} className="w-full bg-black text-white text-[11px] font-black py-3.5 mt-6">
        {saving ? '저장 중...' : '설정 저장하기 ➔'}
      </button>
    </div>
  );
}

function LockedTab({ message }: { message: string }) {
  return (
    <div className="max-w-lg border border-border p-10 text-center">
      <div className="text-2xl mb-3">🔒</div>
      <p className="text-sm text-neutral-600 mb-6">{message}</p>
      <Link href="/purchase" className="inline-block bg-black text-white text-[11px] font-black px-6 py-3">
        30일 프리미엄 구독 (월 33,000원)
      </Link>
    </div>
  );
}

function AffiliateSettingsTab() {
  const [coupangKey, setCoupangKey] = useState(false);
  const [tossKey, setTossKey] = useState(false);

  useEffect(() => {
    fetch('/api/keys?provider=COUPANG').then((r) => r.json()).then((d) => setCoupangKey(!!d.hasKey));
    fetch('/api/keys?provider=TOSS').then((r) => r.json()).then((d) => setTossKey(!!d.hasKey));
  }, []);

  return (
    <div className="max-w-lg space-y-4">
      <div className="border border-border p-6">
        <h2 className="font-black text-sm mb-1">🛒 쿠팡 파트너스 (Coupang Partners) API 연동</h2>
        <p className="text-xs text-neutral-400 mb-4">가입하신 쿠팡 파트너스 계정의 Access Key와 Secret Key를 등록하여 쿠파스 전용 포스팅 생성 및 실시간 트래킹 딥링크 발급을 연동합니다.</p>
        <div className={`text-xs mb-3 ${coupangKey ? 'text-emerald-600' : 'text-red-500'}`}>{coupangKey ? '● 연동됨' : '● 미연동 상태'}</div>
        <Link href="/onboarding/coupang" className="block text-center bg-black text-white text-[11px] font-black py-3">
          쿠파스 키 등록 / 재설정
        </Link>
      </div>
      <div className="border border-border p-6">
        <h2 className="font-black text-sm mb-1">🛍️ 토스쇼핑 (Toss Shopping) API 연동</h2>
        <p className="text-xs text-neutral-400 mb-4">발급받은 토스쇼핑의 Access Key, Secret Key 및 파트너 ID(publisherId)를 등록하여 실시간 특가 상품 소싱 및 쉐어링크 발급을 연동합니다.</p>
        <div className={`text-xs mb-3 ${tossKey ? 'text-emerald-600' : 'text-red-500'}`}>{tossKey ? '● 연동됨' : '● 미연동 상태'}</div>
        <Link href="/onboarding/toss" className="block text-center bg-black text-white text-[11px] font-black py-3">
          토스키 등록 / 재설정
        </Link>
      </div>
    </div>
  );
}

function SubscriptionTab() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/subscription').then((r) => r.json()).then((d) => {
      setIsSubscribed(d.isSubscribed);
      setExpiresAt(d.expiresAt);
    });
  }, []);

  return (
    <div className="max-w-lg border border-border p-6">
      <h2 className="font-black text-sm mb-1">💎 유쓰레드 멤버십 구독 현황</h2>
      <p className="text-xs text-neutral-400 mb-4">현재 이용 중인 프리미엄 멤버십 플랜과 구독 만료일을 확인합니다.</p>
      <div className="border border-border p-4 mb-4">
        <div className={`text-xs font-bold mb-1 ${isSubscribed ? 'text-emerald-600' : 'text-neutral-400'}`}>
          {isSubscribed ? '● 활성 중' : '● 만료됨'}
        </div>
        <div className="text-lg font-black">{isSubscribed ? '프리미엄 멤버십' : '체험 및 무료 플랜'}</div>
        {isSubscribed && expiresAt && (
          <div className="text-xs text-neutral-400 mt-1">{new Date(expiresAt).toLocaleDateString('ko-KR')}까지</div>
        )}
      </div>
      {!isSubscribed && (
        <p className="text-xs text-neutral-500 mb-4">현재 활성화된 프리미엄 구독이 없습니다. 구독을 시작하여 모든 기능을 제한 없이 이용해 보세요.</p>
      )}
      <Link href="/purchase" className="block text-center bg-black text-white text-[11px] font-black py-3.5">
        {isSubscribed ? '구독 관리' : '30일 프리미엄 구독 시작하기 (월 33,000원)'}
      </Link>
    </div>
  );
}

export default function MyPage() {
  const [tab, setTab] = useState<Tab>('계정 설정');

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">마이페이지 설정</h1>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-black ${tab === t ? 'bg-black text-white' : 'border border-border text-neutral-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === '계정 설정' && <AccountTab />}
      {tab === 'AI 설정' && <AiSettingsTab />}
      {tab === '글양식 설정' && <EditorFormatTab />}
      {tab === '쓰레드 설정' && (
        <LockedTab message="스레드 다중 계정 연동 및 계정별 페르소나 자동 매핑 기능은 프리미엄 멤버십 구독 후 이용하실 수 있습니다." />
      )}
      {tab === '제휴 설정' && <AffiliateSettingsTab />}
      {tab === '구독 관리' && <SubscriptionTab />}
    </div>
  );
}
