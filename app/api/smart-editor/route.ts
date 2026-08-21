import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../lib/vaultCrypto';

// 쓰레드 바이럴 패턴(정보나열형/광고티 금지, 총정리·위트한줄·개인서사 3종 포맷,
// 첫 줄에 훅, 해시태그 2~3개, 외부링크 금지)을 시스템 프롬프트에 반영해서 글을 생성한다.
const SYSTEM_PROMPT = `너는 쓰레드(Threads) 바이럴 글쓰기 전문가다. 아래 규칙을 반드시 지켜라.

금지: 순수 정보나열형/백과사전 어투("~에 좋습니다/주의하세요" 식), 광고 티 나는 문구, 지어낸 경험담이나 검증 안 된 숫자.

허용 포맷 3종 중 하나로 작성:
1. 총정리/치트시트 — 압축된 정보를 리스트로 정리
2. 위트있는 한 줄 — 유행어/공감형 문구 + 검증 가능한 사실 하나
3. 개인 서사 — 실제로 있을 법한 자연스러운 경험 기반(과장된 숫자 금지)

형식: 첫 줄에 숫자·의외성·질문 중 하나로 훅을 만들 것. 본문에 외부 링크 넣지 말 것. 해시태그는 2~3개까지만.
결과는 JSON으로만 출력: {"content": "..."}`;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.topic?.trim()) return NextResponse.json({ error: 'topic이 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();

  // 사용자가 /onboarding에서 등록한 개인 Gemini 키를 가져온다(BYOK).
  const { data: keyRow } = await supabase
    .from('ut_api_keys_vault')
    .select('encrypted_values')
    .eq('user_id', user.id)
    .eq('provider', 'GEMINI')
    .maybeSingle();

  const encryptedKey = keyRow?.encrypted_values?.apiKey;
  if (!encryptedKey) {
    return NextResponse.json({ error: 'Gemini API 키가 등록되어 있지 않습니다. /onboarding에서 먼저 등록해주세요.' }, { status: 400 });
  }
  const apiKey = decryptVaultValue(encryptedKey);

  let personaContext = '';
  if (body.personaId) {
    const { data: persona } = await supabase.from('ut_personas').select('*').eq('id', body.personaId).eq('user_id', user.id).maybeSingle();
    if (persona) {
      personaContext = `\n\n말투: ${persona.tone_prompt || '기본'}\n타겟: ${persona.target_prompt || '일반 독자'}`;
    }
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT + personaContext }] },
      contents: [{ role: 'user', parts: [{ text: `주제: ${body.topic}` }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return NextResponse.json({ error: `Gemini 요청 실패 (${res.status}): ${errText.slice(0, 300)}` }, { status: 500 });
  }

  const json = await res.json();
  const rawText = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
  let content = '';
  try {
    content = JSON.parse(rawText).content;
  } catch {
    content = rawText;
  }

  const { data: post, error } = await supabase
    .from('ut_thread_posts')
    .insert({ user_id: user.id, persona_id: body.personaId || null, topic: body.topic, content, status: 'draft' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_thread_posts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data || [] });
}
