'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Persona = { id: string; name: string; tone_prompt?: string };
type SystemPersona = { id: string; name: string; prompt?: string };

type AccountPlan = {
  id: string;
  label: string;
  target_age: string | null;
  target_gender: string | null;
  category: string | null;
  step_gmail: boolean;
  step_instagram: boolean;
  step_subaccount: boolean;
  step_threads_connected: boolean;
  persona_id: string | null;
  persona_is_system: boolean;
  notes: string | null;
  backstory: string | null;
  suggested_handle: string | null;
  ratio_daily: number;
  ratio_shopping: number;
  viral_view_threshold: number;
  viral_unlocked: boolean;
  mission_cycle_position: number;
};

const PERSONA_RULES: { match: RegExp; name: string; reason: string }[] = [
  { match: /꿀템|리뷰|쇼핑|다이소|살림|생활/, name: '호들갑 꿀템/리얼 찐리뷰어 (다이소/코스트코 스타일)', reason: '쇼핑·꿀템 카테고리엔 호들갑 리뷰 톤이 반응이 좋아요' },
  { match: /힐링|위로|감성|공감/, name: '공감 100% 힐링/위로형 감성 톤', reason: '위로·감성 카테고리에 맞는 톤이에요' },
  { match: /정보|트렌드|꿀팁|지식/, name: '인사이트/팩트 요약형 전문가 (지식/트렌드 큐레이터)', reason: '정보·트렌드 카테고리엔 팩트 요약형이 신뢰도가 높아요' },
  { match: /썰|스토리|에세이|후기담/, name: '스토리텔링/웹소설형 후킹 에세이', reason: '서사형 콘텐츠엔 후킹 에세이 톤이 잘 맞아요' },
  { match: /일상|부부|유머|공감밀착/, name: '현실 부부 일상/유머 (Hey Mongle 스타일)', reason: '일상·유머 카테고리엔 친근한 반말체가 잘 맞아요' },
];

function recommendPersona(category: string): { name: string; reason: string } | null {
  if (!category.trim()) return null;
  for (const rule of PERSONA_RULES) {
    if (rule.match.test(category)) return { name: rule.name, reason: rule.reason };
  }
  return null;
}

type ConceptLeaf = { label: string; daily: string[]; intro: string[]; personaName: string; backstory: string; targetAge?: string; handle?: string };
type ConceptGroup = { label: string; icon: string; items: ConceptLeaf[] };

// 컨셉을 넓은 분야 → 세부 컨셉 순으로 좁혀가면서 고를 수 있게. 각 컨셉은 "평소에 할 얘기(일상글 소재)"와
// "나중에 소개할 것(쇼핑글 소재)"이 자연스럽게 이어지도록 짝지어놨다 — 소재 고갈/부자연스러운 광고 전환을 막기 위함.
const CONCEPT_TREE: ConceptGroup[] = [
  {
    label: '직업/경험담 (알바~경력직)',
    icon: '🧑‍🍳',
    items: [
      { label: '과일가게 알바생', daily: ['오늘 들어온 과일 자랑', '진상 손님 썰', '사장님이 알려준 꿀팁'], intro: ['제철 과일', '과일 손질도구', '홈베이킹 재료'], personaName: '스토리텔링/웹소설형 후킹 에세이', backstory: '○○동 과일가게 알바 2년차 · 자전거로 통근 · 자취 중 · 취미는 홈베이킹', targetAge: '20-30대', handle: 'fruit_alba_diary' },
      { label: '핫도그/분식집 알바생', daily: ['오늘 마감 썰', '단골 손님 에피소드', '메뉴 실수담'], intro: ['분식/간식류', '소스·조미료', '홈시어터 소품'], personaName: '호들갑 꿀템/리얼 찐리뷰어 (다이소/코스트코 스타일)', backstory: '역 앞 분식집 알바 1년차 · 도보로 통근 · 학업/직장 병행 · 취미는 드라마 정주행', targetAge: '10대 후반-20대', handle: 'hotdog_alba_log' },
      { label: '편의점 알바생', daily: ['새벽 알바 썰', '희귀템 입고 소식', '진상 손님 대처기'], intro: ['편의점 꿀템', '생활잡화', '만화·굿즈'], personaName: '호들갑 꿀템/리얼 찐리뷰어 (다이소/코스트코 스타일)', backstory: '동네 편의점 야간 알바 · 버스로 통근 · 자취 중 · 취미는 만화·웹툰', targetAge: '20대', handle: 'cvs_night_alba' },
      { label: '카페 알바생', daily: ['오늘의 손님 관찰기', '신메뉴 시음 후기', '바리스타 성장기'], intro: ['커피용품', '홈카페 도구', '카메라 소품'], personaName: '스토리텔링/웹소설형 후킹 에세이', backstory: '동네 개인카페 알바 · 자전거로 통근 · 바리스타 자격증 준비 중 · 취미는 사진촬영', targetAge: '20대', handle: 'cafe_alba_log' },
      { label: '15년차 방과후 강사', daily: ['오늘 수업 에피소드', '학부모 상담 썰', '경력자만 아는 노하우'], intro: ['교구/학습용품', '수업 도구', '도서'], personaName: '인사이트/팩트 요약형 전문가 (지식/트렌드 큐레이터)', backstory: '지역 초등학교 방과후 강사 15년차 · 자차로 이동 · 자녀 있음 · 취미는 독서', targetAge: '40대', handle: 'afterschool_15y' },
    ],
  },
  {
    label: '살림/생활꿀템',
    icon: '🧹',
    items: [
      { label: '자취생 살림템', daily: ['오늘 저녁 뭐 해먹었는지', '자취 초보 시행착오', '집안일 잔짜증'], intro: ['주방용품', '청소·수납템', '주방가전'], personaName: '호들갑 꿀템/리얼 찐리뷰어 (다이소/코스트코 스타일)', backstory: '1인 가구 자취 3년차 · 원룸 거주 · 도보/지하철 이동 · 취미는 넷플릭스+요리', targetAge: '20-30대', handle: 'self_living_tips' },
      { label: '신혼부부 살림', daily: ['부부 티키타카', '살림 분담 썰', '집들이 준비기'], intro: ['가전', '인테리어 소품', '캠핑용품'], personaName: '현실 부부 일상/유머 (Hey Mongle 스타일)', backstory: '결혼 1년차 신혼부부 · 아파트 전세 거주 · 맞벌이 · 취미는 주말 캠핑', targetAge: '30대', handle: 'newlywed_diary' },
      { label: '미니멀 라이프', daily: ['비움 기록', '정리 전후 비교'], intro: ['수납/정리 도구', '워킹화'], personaName: '인사이트/팩트 요약형 전문가 (지식/트렌드 큐레이터)', backstory: '1인 가구 · 미니멀 라이프 2년차 · 자전거 이동 · 취미는 산책', targetAge: '30대', handle: 'minimal_life_log' },
    ],
  },
  {
    label: '육아/부부일상',
    icon: '👶',
    items: [
      { label: '초보 부모 일상', daily: ['육아 웃픈 썰', '아이 성장 기록'], intro: ['육아용품', '유아식'], personaName: '현실 부부 일상/유머 (Hey Mongle 스타일)', backstory: '돌쟁이 아이 키우는 초보 부모 · 아파트 거주 · 자차 이동 · 취미는 육아템 리서치', targetAge: '30대', handle: 'newbie_parent_log' },
      { label: '워킹맘/대디', daily: ['시간관리 고충', '퇴근 후 육아 전쟁'], intro: ['시간절약템', '간편식', '커피용품'], personaName: '현실 부부 일상/유머 (Hey Mongle 스타일)', backstory: '초등생 자녀 있는 워킹맘/대디 · 맞벌이 · 대중교통 이동 · 취미는 홈카페', targetAge: '30-40대', handle: 'workingparent_diary' },
    ],
  },
  {
    label: '뷰티/헬스',
    icon: '💄',
    items: [
      { label: '홈트/운동 루틴', daily: ['오늘 운동 기록', '작심삼일 극복담'], intro: ['운동용품', '보충제', '아웃도어용품'], personaName: '인사이트/팩트 요약형 전문가 (지식/트렌드 큐레이터)', backstory: '직장인 홈트 3개월차 · 원룸 거주 · 도보 이동 · 취미는 등산·러닝', targetAge: '20-30대', handle: 'hometraining_log' },
      { label: '스킨케어 루틴', daily: ['피부 고민 기록', '루틴 변화 후기'], intro: ['화장품', '뷰티기기'], personaName: '공감 100% 힐링/위로형 감성 톤', backstory: '20대 직장인 · 오피스텔 거주 · 대중교통 이동 · 취미는 독서', targetAge: '20대', handle: 'skincare_routine_log' },
    ],
  },
  {
    label: '반려동물',
    icon: '🐶',
    items: [
      { label: '강아지 일상', daily: ['오늘 산책 기록', '웃긴 행동 관찰'], intro: ['사료·간식', '위생용품', '외출용품'], personaName: '공감 100% 힐링/위로형 감성 톤', backstory: '강아지 집사 2년차 · 아파트 거주 · 매일 산책 · 취미는 드라이브', targetAge: '20-30대', handle: 'puppy_daily_diary' },
      { label: '고양이 집사', daily: ['냥집사 하루', '츄르 반응 관찰'], intro: ['캣타워', '모래·간식', '인테리어 소품'], personaName: '공감 100% 힐링/위로형 감성 톤', backstory: '고양이 두 마리 집사 · 원룸 거주 · 재택근무 · 취미는 인테리어 꾸미기', targetAge: '20-30대', handle: 'cat_sitter_log' },
    ],
  },
  {
    label: '정보/트렌드',
    icon: '📚',
    items: [
      { label: '재테크/절약', daily: ['오늘의 절약 기록', '가계부 공유'], intro: ['가성비템', '정기구독 서비스', '재테크 도서'], personaName: '인사이트/팩트 요약형 전문가 (지식/트렌드 큐레이터)', backstory: '사회초년생 · 자취 중 · 대중교통 이용 · 취미는 재테크 스터디', targetAge: '20-30대', handle: 'saving_money_log' },
      { label: '생활꿀팁', daily: ['오늘 알게 된 꿀팁'], intro: ['아이디어 상품', '수납용품'], personaName: '인사이트/팩트 요약형 전문가 (지식/트렌드 큐레이터)', backstory: '평범한 직장인 · 자취 중 · 대중교통 이용 · 취미는 정리정돈', targetAge: '20-30대', handle: 'life_hack_tip_log' },
    ],
  },
];

function computeMission(p: AccountPlan): { type: 'daily' | 'shopping'; locked: boolean } {
  const cycleLen = Math.max(1, p.ratio_daily + p.ratio_shopping);
  const pos = p.mission_cycle_position % cycleLen;
  const wantsShopping = pos >= p.ratio_daily;
  if (wantsShopping && !p.viral_unlocked) return { type: 'daily', locked: true };
  return { type: wantsShopping ? 'shopping' : 'daily', locked: false };
}

const STEPS: { key: keyof AccountPlan; title: string; desc: string }[] = [
  { key: 'step_gmail', title: '1. 지메일 계정 만들기', desc: '전화번호 대신 반드시 구글 계정(Gmail)으로 가입해야 인스타 부계정을 최대 5개까지 붙일 수 있어요.' },
  { key: 'step_instagram', title: '2. 인스타그램 가입', desc: '방금 만든 Gmail로 인스타그램에 가입해요.' },
  { key: 'step_subaccount', title: '3. 부계정 추가', desc: '인스타 설정 → 계정 추가에서 부계정을 만들어요 (계정 하나당 최대 5개). 처음엔 3개 정도로 시작 추천.' },
  { key: 'step_threads_connected', title: '4. 쓰레드 전환 + 연동', desc: '인스타에서 쓰레드로 넘어간 뒤 "내 쓰레드 관리"에서 실제 계정과 연동해요.' },
];

const EMPTY_FORM = { label: '', target_age: '', target_gender: '', category: '', persona_key: '', notes: '', backstory: '', suggested_handle: '' };

function findConceptLeaf(category: string | null, saved: ConceptLeaf[]): ConceptLeaf | null {
  if (!category) return null;
  const flatStatic = CONCEPT_TREE.flatMap((g) => g.items);
  return [...flatStatic, ...saved].find((c) => c.label === category) || null;
}

export default function AccountPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<AccountPlan[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [systemPersonas, setSystemPersonas] = useState<SystemPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [viewCountInput, setViewCountInput] = useState<Record<string, string>>({});
  const [draftStatus, setDraftStatus] = useState<Record<string, string>>({});
  const [savedConcepts, setSavedConcepts] = useState<ConceptLeaf[]>([]);
  const [recommending, setRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ open: boolean; forPlanId: string | null; groupIdx: number | null; leaf: ConceptLeaf | null; isNewSuggestion: boolean }>({
    open: false,
    forPlanId: null,
    groupIdx: null,
    leaf: null,
    isNewSuggestion: false,
  });

  function openPicker(forPlanId: string | null) {
    setRecommendError(null);
    setPicker({ open: true, forPlanId, groupIdx: null, leaf: null, isNewSuggestion: false });
  }
  function closePicker() {
    setPicker({ open: false, forPlanId: null, groupIdx: null, leaf: null, isNewSuggestion: false });
  }

  async function requestAiConcept() {
    setRecommending(true);
    setRecommendError(null);
    try {
      const res = await fetch('/api/concepts/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 추천 실패');
      const leaf: ConceptLeaf = {
        label: data.concept.label,
        daily: data.concept.daily || [],
        intro: data.concept.intro || [],
        backstory: data.concept.backstory || '',
        personaName: data.concept.personaName,
        targetAge: data.concept.targetAge || undefined,
        handle: data.concept.handle || undefined,
      };
      setPicker((s) => ({ ...s, leaf, isNewSuggestion: true }));
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : String(err));
    } finally {
      setRecommending(false);
    }
  }

  async function commitConcept(leaf: ConceptLeaf, gender: string) {
    const persona = systemPersonas.find((sp) => sp.name === leaf.personaName);
    const patch: Record<string, unknown> = {
      category: leaf.label,
      target_gender: gender,
      persona_id: persona?.id || null,
      persona_is_system: true,
      backstory: leaf.backstory,
    };
    if (leaf.targetAge) patch.target_age = leaf.targetAge;
    if (leaf.handle) patch.suggested_handle = leaf.handle;
    if (picker.forPlanId) {
      await fetch(`/api/account-plans/${picker.forPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      load();
    } else {
      setForm((f) => ({
        ...f,
        label: f.label.trim() ? f.label : leaf.label,
        category: leaf.label,
        target_age: leaf.targetAge || f.target_age,
        target_gender: gender,
        persona_key: persona ? `sys:${persona.id}` : f.persona_key,
        backstory: leaf.backstory,
        suggested_handle: leaf.handle || f.suggested_handle,
      }));
    }
    if (picker.isNewSuggestion) {
      fetch('/api/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: leaf.label,
          daily: leaf.daily,
          intro: leaf.intro,
          backstory: leaf.backstory,
          persona_name: leaf.personaName,
          target_age: leaf.targetAge,
          handle: leaf.handle,
        }),
      }).then(() =>
        fetch('/api/concepts')
          .then((r) => r.json())
          .then((d) =>
            setSavedConcepts(
              (d.concepts || []).map(
                (c: { label: string; daily: string[]; intro: string[]; backstory: string | null; persona_name: string; target_age: string | null; handle: string | null }) => ({
                  label: c.label,
                  daily: c.daily,
                  intro: c.intro,
                  backstory: c.backstory || '',
                  personaName: c.persona_name,
                  targetAge: c.target_age || undefined,
                  handle: c.handle || undefined,
                })
              )
            )
          )
      );
    }
    closePicker();
  }

  function load() {
    fetch('/api/account-plans').then((r) => r.json()).then((d) => setPlans(d.plans || []));
    fetch('/api/personas').then((r) => r.json()).then((d) => setPersonas(d.personas || []));
    fetch('/api/personas/system').then((r) => r.json()).then((d) => setSystemPersonas(d.systemPersonas || []));
    fetch('/api/concepts')
      .then((r) => r.json())
      .then((d) =>
        setSavedConcepts(
          (d.concepts || []).map((c: { label: string; daily: string[]; intro: string[]; backstory: string | null; persona_name: string; target_age: string | null; handle: string | null }) => ({
            label: c.label,
            daily: c.daily,
            intro: c.intro,
            backstory: c.backstory || '',
            personaName: c.persona_name,
            targetAge: c.target_age || undefined,
            handle: c.handle || undefined,
          }))
        )
      );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function personaKey(id: string | null, isSystem: boolean) {
    return id ? `${isSystem ? 'sys' : 'own'}:${id}` : '';
  }

  function personaLabel(id: string | null, isSystem: boolean) {
    if (!id) return null;
    const list = isSystem ? systemPersonas : personas;
    return list.find((p) => p.id === id)?.name || null;
  }

  async function handleCreate() {
    if (!form.label.trim()) return;
    setSaving(true);
    const [scope, personaId] = form.persona_key ? form.persona_key.split(':') : [null, null];
    try {
      await fetch('/api/account-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label,
          target_age: form.target_age,
          target_gender: form.target_gender,
          category: form.category,
          persona_id: personaId || null,
          persona_is_system: scope === 'sys',
          notes: form.notes,
          backstory: form.backstory,
          suggested_handle: form.suggested_handle,
        }),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleStep(plan: AccountPlan, key: keyof AccountPlan) {
    const updated = { ...plan, [key]: !plan[key] };
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    await fetch(`/api/account-plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: updated[key] }),
    });
  }

  async function updatePersona(plan: AccountPlan, key: string) {
    const [scope, personaId] = key ? key.split(':') : [null, null];
    await fetch(`/api/account-plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id: personaId || null, persona_is_system: scope === 'sys' }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('이 계정 플랜을 삭제할까요?')) return;
    await fetch(`/api/account-plans/${id}`, { method: 'DELETE' });
    load();
  }

  async function updateRatio(plan: AccountPlan, field: 'ratio_daily' | 'ratio_shopping' | 'viral_view_threshold', value: number) {
    if (Number.isNaN(value) || value < 0) return;
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, [field]: value } : p)));
    await fetch(`/api/account-plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function completeMission(plan: AccountPlan) {
    const mission = computeMission(plan);
    const patch: Record<string, unknown> = { mission_cycle_position: plan.mission_cycle_position + 1 };
    if (mission.type === 'daily') {
      const raw = viewCountInput[plan.id];
      const views = raw ? Number(raw) : 0;
      if (views >= plan.viral_view_threshold && !plan.viral_unlocked) {
        patch.viral_unlocked = true;
      }
    }
    await fetch(`/api/account-plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setViewCountInput((prev) => ({ ...prev, [plan.id]: '' }));
    load();
  }

  async function generateMissionDraft(plan: AccountPlan) {
    const mission = computeMission(plan);
    if (mission.locked) return;

    if (mission.type === 'shopping') {
      // 쿠팡 링크는 자동 소싱이 안 되니(매출 15만원 전까진 API도 없음), 직접 상품/링크를 넣는 글쓰기 화면으로 보낸다.
      router.push('/write');
      return;
    }

    const leaf = findConceptLeaf(plan.category, savedConcepts);
    const dailyIdea = leaf?.daily?.length ? leaf.daily[Math.floor(Math.random() * leaf.daily.length)] : null;
    const topic = [plan.category, dailyIdea, plan.backstory].filter(Boolean).join(' — ') || plan.label;

    setDraftStatus((prev) => ({ ...prev, [plan.id]: 'generating' }));
    try {
      const res = await fetch('/api/smart-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          personaId: plan.persona_id || undefined,
          personaIsSystem: plan.persona_is_system,
          resultStyle: plan.persona_id ? 'persona' : 'basic',
          mode: 'casual',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setDraftStatus((prev) => ({ ...prev, [plan.id]: 'done' }));
    } catch (err) {
      setDraftStatus((prev) => ({ ...prev, [plan.id]: `error:${err instanceof Error ? err.message : String(err)}` }));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-accent inline-block" />
          <h1 className="text-xl font-black">계정 확장 플랜</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-accent text-white text-[11px] font-black px-5 py-3">
          + 새 계정 플랜
        </button>
      </div>
      <p className="text-xs text-neutral-400 mb-6">
        지메일 → 인스타그램 → 부계정 → 쓰레드 연동 순서로 계정을 늘려갈 때, 계정마다 타겟(연령/성별/카테고리)과 페르소나를 미리 정해두고 진행 단계를 체크하는 곳이에요.
      </p>

      {loading ? (
        <div className="text-sm text-neutral-400 text-center py-20">불러오는 중...</div>
      ) : plans.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center text-sm text-neutral-400">
          아직 계정 플랜이 없어요. &quot;+ 새 계정 플랜&quot;으로 시작해보세요.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((p) => {
            const done = STEPS.filter((s) => p[s.key]).length;
            const mission = computeMission(p);
            const suggestion = recommendPersona(p.category || '');
            const currentPersonaName = personaLabel(p.persona_id, p.persona_is_system);
            return (
              <div key={p.id} className="border border-border p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-black text-sm">{p.label}</h3>
                  <button onClick={() => handleDelete(p.id)} className="text-[11px] text-red-500 font-bold">
                    삭제
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {p.target_age && <span className="text-[10px] bg-neutral-100 font-bold px-2 py-0.5">{p.target_age}</span>}
                  {p.target_gender && <span className="text-[10px] bg-neutral-100 font-bold px-2 py-0.5">{p.target_gender}</span>}
                  {p.category && <span className="text-[10px] bg-neutral-100 font-bold px-2 py-0.5">{p.category}</span>}
                  {p.suggested_handle && <span className="text-[10px] bg-neutral-100 font-bold px-2 py-0.5">🆔 @{p.suggested_handle}</span>}
                  <button onClick={() => openPicker(p.id)} className="text-[10px] text-accent font-bold underline">
                    🧭 컨셉 다시 고르기
                  </button>
                </div>

                <div className={`border p-3 mb-3 ${mission.locked ? 'bg-neutral-50 border-neutral-200' : mission.type === 'shopping' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                  {mission.locked ? (
                    <div className="text-xs font-bold text-neutral-400">
                      🔒 쇼핑글 아직 잠김 — 일상글 조회수 {p.viral_view_threshold.toLocaleString()}회 이상 터뜨리면 열려요
                    </div>
                  ) : (
                    <div className="text-xs font-bold">
                      {mission.type === 'shopping' ? '🛒 오늘의 미션: 쇼핑글 써도 돼요!' : '📝 오늘의 미션: 일상글을 써보세요'}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {mission.type === 'daily' && (
                      <input
                        type="number"
                        placeholder="달성 조회수(선택)"
                        value={viewCountInput[p.id] || ''}
                        onChange={(e) => setViewCountInput((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="border border-border px-2 py-1.5 text-[11px] w-32"
                      />
                    )}
                    <button onClick={() => completeMission(p)} className="text-[11px] font-bold bg-black text-white px-3 py-1.5">
                      미션 완료
                    </button>
                    {!mission.locked && (
                      <button
                        onClick={() => generateMissionDraft(p)}
                        disabled={draftStatus[p.id] === 'generating'}
                        className="text-[11px] font-bold border border-accent text-accent px-3 py-1.5 disabled:opacity-50"
                      >
                        {draftStatus[p.id] === 'generating' ? '✍️ 생성 중...' : mission.type === 'shopping' ? '✍️ 글쓰기로 이동' : '✍️ 반자동 초안 만들기'}
                      </button>
                    )}
                  </div>
                  {draftStatus[p.id] === 'done' && (
                    <div className="text-[11px] text-green-600 font-bold mt-2">
                      ✅ 초안 생성됨 →{' '}
                      <button onClick={() => router.push('/write')} className="underline">
                        검수하러 가기
                      </button>
                    </div>
                  )}
                  {draftStatus[p.id]?.startsWith('error:') && (
                    <div className="text-[11px] text-red-500 mt-2">❌ {draftStatus[p.id].slice(6)}</div>
                  )}
                </div>

                <details className="mb-3">
                  <summary className="text-[11px] font-bold text-neutral-400 cursor-pointer">⚙️ 비율/기준 설정 ({p.ratio_daily}:{p.ratio_shopping}, {p.viral_view_threshold.toLocaleString()}회)</summary>
                  <div className="flex items-center gap-2 mt-2 text-[11px]">
                    <span>일상글</span>
                    <input type="number" min={0} value={p.ratio_daily} onChange={(e) => updateRatio(p, 'ratio_daily', Number(e.target.value))} className="border border-border w-14 px-1.5 py-1" />
                    <span>: 쇼핑글</span>
                    <input type="number" min={0} value={p.ratio_shopping} onChange={(e) => updateRatio(p, 'ratio_shopping', Number(e.target.value))} className="border border-border w-14 px-1.5 py-1" />
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[11px]">
                    <span>해제 조회수 기준</span>
                    <input type="number" min={0} value={p.viral_view_threshold} onChange={(e) => updateRatio(p, 'viral_view_threshold', Number(e.target.value))} className="border border-border w-24 px-1.5 py-1" />
                  </div>
                  {p.viral_unlocked && <div className="text-[11px] text-green-600 font-bold mt-2">✅ 쇼핑글 해제됨</div>}
                </details>

                <div className="w-full h-1.5 bg-neutral-100 mb-3">
                  <div className="h-1.5 bg-accent" style={{ width: `${(done / STEPS.length) * 100}%` }} />
                </div>

                <div className="space-y-2 mb-4">
                  {STEPS.map((s) => (
                    <label key={String(s.key)} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!p[s.key]}
                        onChange={() => toggleStep(p, s.key)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className={`text-xs font-bold ${p[s.key] ? 'line-through text-neutral-300' : ''}`}>{s.title}</div>
                        <div className="text-[11px] text-neutral-400">{s.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <label className="text-[11px] font-bold text-neutral-500 mb-1 block">페르소나</label>
                <select
                  value={personaKey(p.persona_id, p.persona_is_system)}
                  onChange={(e) => updatePersona(p, e.target.value)}
                  className="w-full border border-border px-2 py-2 text-xs mb-1"
                >
                  <option value="">선택 안 함</option>
                  {systemPersonas.map((sp) => (
                    <option key={`sys:${sp.id}`} value={`sys:${sp.id}`}>
                      {sp.name} (시스템)
                    </option>
                  ))}
                  {personas.map((op) => (
                    <option key={`own:${op.id}`} value={`own:${op.id}`}>
                      {op.name}
                    </option>
                  ))}
                </select>
                {currentPersonaName && <div className="text-[11px] text-neutral-400">현재: {currentPersonaName}</div>}
                {suggestion && suggestion.name !== currentPersonaName && (
                  <div className="text-[11px] text-accent font-bold mt-1">💡 추천: {suggestion.name.split(' (')[0]} — {suggestion.reason}</div>
                )}

                {p.backstory && <p className="text-[11px] text-neutral-500 border-t border-border mt-3 pt-3">👤 {p.backstory}</p>}
                {p.notes && <p className="text-xs text-neutral-500 whitespace-pre-wrap mt-2">{p.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white p-6 max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-black mb-4">+ 새 계정 플랜</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-neutral-500 mb-1 block">계정 이름 *</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="예: 계정1 - 자취 살림템"
                  className="w-full border border-border px-3 py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-neutral-500 mb-1 block">타겟 연령</label>
                  <input
                    value={form.target_age}
                    onChange={(e) => setForm((f) => ({ ...f, target_age: e.target.value }))}
                    placeholder="예: 20-30대"
                    className="w-full border border-border px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-neutral-500 mb-1 block">타겟 성별</label>
                  <input
                    value={form.target_gender}
                    onChange={(e) => setForm((f) => ({ ...f, target_gender: e.target.value }))}
                    placeholder="예: 여성"
                    className="w-full border border-border px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-neutral-500 block">카테고리</label>
                  <button type="button" onClick={() => openPicker(null)} className="text-[11px] text-accent font-bold underline">
                    🧭 컨셉 골라보기
                  </button>
                </div>
                <input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="예: 살림/생활꿀템 (또는 위 버튼으로 골라보세요)"
                  className="w-full border border-border px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-500 mb-1 block">페르소나</label>
                <select
                  value={form.persona_key}
                  onChange={(e) => setForm((f) => ({ ...f, persona_key: e.target.value }))}
                  className="w-full border border-border px-3 py-2.5 text-sm"
                >
                  <option value="">선택 안 함</option>
                  {systemPersonas.map((sp) => (
                    <option key={`sys:${sp.id}`} value={`sys:${sp.id}`}>
                      {sp.name} (시스템)
                    </option>
                  ))}
                  {personas.map((op) => (
                    <option key={`own:${op.id}`} value={`own:${op.id}`}>
                      {op.name}
                    </option>
                  ))}
                </select>
                {(() => {
                  const s = recommendPersona(form.category);
                  return s ? (
                    <div className="text-[11px] text-accent font-bold mt-1">💡 추천: {s.name.split(' (')[0]} — {s.reason}</div>
                  ) : null;
                })()}
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-500 mb-1 block">추천 아이디</label>
                <input
                  value={form.suggested_handle}
                  onChange={(e) => setForm((f) => ({ ...f, suggested_handle: e.target.value }))}
                  placeholder="예: fruit_alba_diary (컨셉 고르면 자동 채워짐)"
                  className="w-full border border-border px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-500 mb-1 block">설정 (근무지/거주지/이동수단/취미)</label>
                <input
                  value={form.backstory}
                  onChange={(e) => setForm((f) => ({ ...f, backstory: e.target.value }))}
                  placeholder="예: ○○동 과일가게 알바 2년차 · 자전거로 통근 · 자취 중 · 취미는 홈베이킹"
                  className="w-full border border-border px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-500 mb-1 block">메모</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-border px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-border text-[11px] font-black py-3">
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.label.trim()}
                className="flex-1 bg-accent text-white text-[11px] font-black py-3 disabled:opacity-40"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {picker.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closePicker}>
          <div className="bg-white p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {picker.groupIdx === null && picker.leaf === null ? (
              <>
                <h2 className="font-black mb-1">🧭 분야를 골라주세요</h2>
                <p className="text-xs text-neutral-400 mb-4">하루 2~5개 소재만 꾸준히 나오면 충분해요 — 넓게 고민하지 말고 감 오는 걸로 골라보세요.</p>

                <button
                  onClick={requestAiConcept}
                  disabled={recommending}
                  className="w-full border border-accent text-accent font-black text-xs py-3 mb-2 disabled:opacity-50"
                >
                  {recommending ? '✨ AI가 컨셉 짜는 중...' : '✨ AI로 새 컨셉 추천받기'}
                </button>
                {recommendError && <div className="text-[11px] text-red-500 mb-3">{recommendError}</div>}

                {savedConcepts.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11px] font-bold text-neutral-400 mb-2">💾 저장된 컨셉</div>
                    <div className="space-y-2">
                      {savedConcepts.map((c) => (
                        <button
                          key={c.label}
                          onClick={() => setPicker((s) => ({ ...s, leaf: c, isNewSuggestion: false }))}
                          className="w-full text-left border border-border p-3 hover:bg-neutral-50"
                        >
                          <div className="text-xs font-bold">{c.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[11px] font-bold text-neutral-400 mb-2">직접 골라보기</div>
                <div className="grid grid-cols-2 gap-2">
                  {CONCEPT_TREE.map((g, i) => (
                    <button
                      key={g.label}
                      onClick={() => setPicker((s) => ({ ...s, groupIdx: i }))}
                      className="border border-border p-4 text-left hover:bg-neutral-50"
                    >
                      <div className="text-xl mb-1">{g.icon}</div>
                      <div className="text-xs font-bold">{g.label}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : picker.leaf === null && picker.groupIdx !== null ? (
              <>
                <button onClick={() => setPicker((s) => ({ ...s, groupIdx: null }))} className="text-[11px] text-neutral-400 font-bold mb-3">
                  ← 분야 다시 고르기
                </button>
                <h2 className="font-black mb-4">
                  {CONCEPT_TREE[picker.groupIdx].icon} {CONCEPT_TREE[picker.groupIdx].label} — 세부 컨셉을 골라주세요
                </h2>
                <div className="space-y-2">
                  {CONCEPT_TREE[picker.groupIdx].items.map((leaf) => (
                    <button
                      key={leaf.label}
                      onClick={() => setPicker((s) => ({ ...s, leaf }))}
                      className="w-full text-left border border-border p-3 hover:bg-neutral-50"
                    >
                      <div className="text-xs font-bold mb-1">{leaf.label}</div>
                      <div className="text-[11px] text-neutral-400">평소: {leaf.daily.join(' · ')}</div>
                      <div className="text-[11px] text-neutral-400">나중에: {leaf.intro.join(' · ')}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : picker.leaf ? (
              <>
                <button onClick={() => setPicker((s) => ({ ...s, leaf: null }))} className="text-[11px] text-neutral-400 font-bold mb-3">
                  ← 세부 컨셉 다시 고르기
                </button>
                <h2 className="font-black mb-1">{picker.leaf.label}</h2>
                {picker.leaf.targetAge && <div className="text-xs text-neutral-500 mb-1">🎯 추천 타겟연령: {picker.leaf.targetAge}</div>}
                {picker.leaf.handle && <div className="text-xs text-neutral-500 mb-1">🆔 추천 아이디: @{picker.leaf.handle}</div>}
                {picker.leaf.backstory && <div className="text-xs text-neutral-500 mb-1">👤 설정: {picker.leaf.backstory}</div>}
                <div className="text-xs text-neutral-500 mb-1">📝 평소 소재: {picker.leaf.daily.join(' · ')}</div>
                <div className="text-xs text-neutral-500 mb-4">🛒 나중에 소개: {picker.leaf.intro.join(' · ')}</div>
                <p className="text-[11px] font-bold text-neutral-500 mb-2">어느 쪽 관점으로 쓸까요?</p>
                <div className="grid grid-cols-3 gap-2">
                  {['여성', '남성', '무관'].map((g) => {
                    const leaf = picker.leaf;
                    return (
                      <button
                        key={g}
                        onClick={() => leaf && commitConcept(leaf, g)}
                        className="border border-border py-3 text-xs font-bold hover:bg-neutral-50"
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
