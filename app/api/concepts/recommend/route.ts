import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';

const SYSTEM_PERSONA_NAMES = [
  '현실 부부 일상/유머 (Hey Mongle 스타일)',
  '호들갑 꿀템/리얼 찐리뷰어 (다이소/코스트코 스타일)',
  '스토리텔링/웹소설형 후킹 에세이',
  '인사이트/팩트 요약형 전문가 (지식/트렌드 큐레이터)',
  '공감 100% 힐링/위로형 감성 톤',
];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseServerClient();

  // 글 생성과 동일하게 "글양식 기본 설정"의 ai_source(Gemini API / 로컬 워커)를 그대로 따른다.
  const { data: editorDefaults } = await supabase.from('ut_editor_defaults').select('ai_source').eq('user_id', user.id).maybeSingle();
  const useWorker = editorDefaults?.ai_source === 'worker';

  let apiKey = '';
  if (!useWorker) {
    const { data: keyRow } = await supabase
      .from('ut_api_keys_vault')
      .select('encrypted_values')
      .eq('user_id', user.id)
      .eq('provider', 'GEMINI')
      .maybeSingle();
    const encryptedKey = keyRow?.encrypted_values?.apiKey;
    if (!encryptedKey) return NextResponse.json({ error: 'Gemini API 키가 등록되어 있지 않습니다. /onboarding에서 먼저 등록해주세요.' }, { status: 400 });
    apiKey = decryptVaultValue(encryptedKey);
  }

  const { data: existing } = await supabase.from('ut_saved_concepts').select('label').eq('user_id', user.id);
  const avoidList = (existing || []).map((c) => c.label).join(', ');

  const prompt = `쓰레드(Threads) 쇼핑 인플루언서 부캐 컨셉을 하나 추천해라.
조건:
- "직업/알바 경험담" 또는 "생활 밀착형 정체성" 계열로, 매일 자연스러운 일상 소재(2~5개/일)가 계속 나올 수 있어야 한다.
- 그 정체성에서 자연스럽게 이어질 수 있는 제품 소개 카테고리(나중에 쿠팡파트너스로 소개할 것)가 있어야 한다.
- 이미 있는 컨셉과 겹치지 않게 해라: ${avoidList || '(아직 없음)'}${body.hint ? `\n- 참고 힌트: ${body.hint}` : ''}

아래 JSON 형식으로만 응답해라(다른 텍스트 없이):
{
  "label": "컨셉 이름 (예: 과일가게 알바생)",
  "targetAge": "가장 잘 맞는 타겟 연령대 (예: 20-30대)",
  "handle": "쓰레드/인스타 아이디로 쓸 영문 핸들 하나 (소문자, 숫자, 언더바만. 공백·특수문자 금지. 예: fruit_alba_diary)",
  "daily": ["평소 올릴 일상글 소재 2~3개"],
  "intro": ["나중에 소개할 상품 카테고리 2~3개"],
  "backstory": "근무지/거주지/이동수단/취미를 한 줄로 (예: ○○동 과일가게 알바 2년차 · 자전거로 통근 · 자취 중 · 취미는 홈베이킹)",
  "personaName": "다음 중 가장 잘 맞는 것 하나: ${SYSTEM_PERSONA_NAMES.join(' / ')}"
}`;

  let rawText: string;

  if (useWorker) {
    const { data: job, error: jobError } = await supabase
      .from('ut_worker_jobs')
      .insert({ user_id: user.id, type: 'generate', input: { prompt: `${prompt}\n\n(반드시 JSON만 출력, 다른 설명 텍스트 없이.)` } })
      .select()
      .single();
    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

    const deadline = Date.now() + 55000;
    let finished: { status: string; output: { content?: string } | null; error: string | null } | null = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data: polled } = await supabase.from('ut_worker_jobs').select('status, output, error').eq('id', job.id).single();
      if (polled && (polled.status === 'done' || polled.status === 'failed')) {
        finished = polled;
        break;
      }
    }
    if (!finished || finished.status !== 'done') {
      return NextResponse.json(
        { error: finished?.error || '로컬 워커가 응답하지 않았습니다. 워커가 켜져 있는지(node index.js) 확인해주세요.' },
        { status: 500 }
      );
    }
    rawText = finished.output?.content || '';
  } else {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({ error: `Gemini 요청 실패 (${res.status}): ${errText.slice(0, 300)}` }, { status: 500 });
    }
    const json = await res.json();
    rawText = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
  }

  try {
    // 클로드 CLI는 Gemini의 responseMimeType:json 같은 강제 옵션이 없어서 ```json 코드펜스를 붙일 수 있다 — 벗겨내고 파싱.
    const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    if (!parsed.personaName || !SYSTEM_PERSONA_NAMES.includes(parsed.personaName)) {
      parsed.personaName = SYSTEM_PERSONA_NAMES[0];
    }
    return NextResponse.json({ concept: parsed });
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
  }
}
