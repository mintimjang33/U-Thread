import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../lib/vaultCrypto';
import { coupangDeeplink } from '../../../lib/coupangApi';

// 쓰레드 바이럴 패턴(정보나열형/광고티 금지, 총정리·위트한줄·개인서사 3종 포맷,
// 첫 줄에 훅, 해시태그 2~3개, 외부링크 금지)을 시스템 프롬프트에 반영해서 글을 생성한다.
const BASE_SYSTEM_PROMPT = `너는 쓰레드(Threads) 바이럴 글쓰기 전문가다. 아래 규칙을 반드시 지켜라.

금지: 순수 정보나열형/백과사전 어투("~에 좋습니다/주의하세요" 식), 광고 티 나는 문구, 지어낸 경험담이나 검증 안 된 숫자.

허용 포맷 3종 중 하나로 작성:
1. 총정리/치트시트 — 압축된 정보를 리스트로 정리
2. 위트있는 한 줄 — 유행어/공감형 문구 + 검증 가능한 사실 하나
3. 개인 서사 — 실제로 있을 법한 자연스러운 경험 기반(과장된 숫자 금지)

형식: 첫 줄에 숫자·의외성·질문 중 하나로 훅을 만들 것. 해시태그는 2~3개까지만.
결과는 JSON으로만 출력: {"content": "..."}`;

const RESULT_STYLE_ADDON: Record<string, string> = {
  basic: '',
  hook: '\n\n[결과 스타일: 검색/뷰 최적화] 첫 문장의 후킹력을 극대화해라 — 어그로성 질문, 반전, 숫자 충격을 적극 활용해서 클릭/스크롤을 멈추게 만들어라.',
  persona: '\n\n[결과 스타일: 내 페르소나] 아래 지정된 페르소나의 말투·어조를 다른 모든 규칙보다 최우선으로 강하게 반영해라. 페르소나 지침과 충돌하는 일반 규칙은 페르소나를 따른다.',
};

// 국내 광고심의가 엄격한 업종별 표현 제약(일반적으로 알려진 규정 요지, 법률 자문 대체 불가 — 참고용).
const COMPLIANCE_RULES: Record<string, string> = {
  '의료': '의료법 광고 규정: 치료효과를 단정하거나 "완치/100% 효과" 등 과장된 표현 금지. 환자 치료경험담을 광고처럼 포장 금지. 특정 병원/시술 최상급 표현(최고, 1위 등 객관적 근거 없는) 금지.',
  '의약품': '약사법 광고 규정: 승인된 효능·효과 범위를 벗어난 확대 해석 금지. 부작용을 숨기거나 안전성을 과장 금지. "부작용 없음" 같은 단정 표현 금지.',
  '의료기기': '의료기기법 광고 규정: 치료 효과를 오인시키는 표현 금지. 인증/허가받지 않은 효능 주장 금지.',
  '건기식': '건강기능식품법 광고 규정: 질병의 예방·치료 효과를 표현하면 안 됨. 반드시 "이 제품은 질병의 예방 및 치료를 위한 의약품이 아닙니다"에 준하는 뉘앙스를 유지하고, 개인차가 있을 수 있음을 암시해라.',
  '특수식품': '특수용도식품 광고 규정: 과장된 효능·효과 표현 금지, 검증되지 않은 건강 개선 주장 금지.',
  '금융': '금융소비자보호법 광고 규정: 원금 보장을 암시하는 표현 금지, 투자 손실 가능성을 배제하는 단정적 수익 보장 표현 금지.',
  '보험': '보험업법 광고 규정: 보장 범위를 과장하거나 면책조항을 누락한 것처럼 표현 금지, 무조건적 보장을 암시하는 표현 금지.',
  '대부': '대부업법 광고 규정: 법정 최고금리를 초과하는 것처럼 오인시키거나, 손쉬운 대출을 과도하게 유도하는 표현 금지.',
};

type Product = { productName: string; productPrice: number; productUrl: string };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const product = body?.product as Product | undefined;
  const affiliateUrl = body?.affiliateUrl as string | undefined;
  if (!body?.topic?.trim() && !product && !affiliateUrl) {
    return NextResponse.json({ error: 'topic, product, affiliateUrl 중 하나는 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

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
  if (body.personaIsSystem && body.personaId) {
    const { data: sp } = await supabase.from('ut_system_personas').select('prompt').eq('id', body.personaId).maybeSingle();
    if (sp) personaContext = `\n\n페르소나 스타일 지침:\n${sp.prompt}`;
  } else if (body.personaId) {
    const { data: persona } = await supabase.from('ut_personas').select('*').eq('id', body.personaId).eq('user_id', user.id).maybeSingle();
    if (persona) {
      personaContext = `\n\n말투: ${persona.tone_prompt || '기본'}\n타겟: ${persona.target_prompt || '일반 독자'}`;
    }
  }

  const resultStyle: string = ['basic', 'hook', 'persona'].includes(body.resultStyle) ? body.resultStyle : 'basic';
  let systemPrompt = BASE_SYSTEM_PROMPT + RESULT_STYLE_ADDON[resultStyle];

  const complianceCategory = body.complianceCategory as string | undefined;
  if (complianceCategory && COMPLIANCE_RULES[complianceCategory]) {
    systemPrompt += `\n\n[안심 사전 심의필 모드] 다음 업종 광고 규정을 반드시 지켜서 순화된 문구로 작성해라(참고용 가이드이며 실제 법률 검토를 대체하지 않음을 유의):\n${COMPLIANCE_RULES[complianceCategory]}`;
  }

  let userPrompt = `주제: ${body.topic || ''}`;
  let deeplink: string | null = null;

  if (product) {
    userPrompt = `아래 쿠팡 상품에 대한 리뷰형 쓰레드 글을 써줘.\n상품명: ${product.productName}\n가격: ${product.productPrice.toLocaleString()}원\n${body.topic ? `추가 강조할 내용: ${body.topic}` : ''}`;
    const { data: keyRow2 } = await supabase
      .from('ut_api_keys_vault')
      .select('encrypted_values')
      .eq('user_id', user.id)
      .eq('provider', 'COUPANG')
      .maybeSingle();
    const coupangEnc = keyRow2?.encrypted_values;
    if (coupangEnc?.accessKey && coupangEnc?.secretKey) {
      try {
        const links = await coupangDeeplink(
          decryptVaultValue(coupangEnc.accessKey),
          decryptVaultValue(coupangEnc.secretKey),
          [product.productUrl]
        );
        deeplink = links[0]?.shortenUrl || links[0]?.landingUrl || null;
      } catch {
        deeplink = null;
      }
    }
  } else if (affiliateUrl) {
    userPrompt = `아래 제품/서비스를 자연스럽게 소개하는 제휴 마케팅 쓰레드 글을 써줘.\n제품명: ${body.affiliateProductName || '(제품명 미상)'}\n${body.topic ? `추가 설명: ${body.topic}` : ''}`;
    deeplink = affiliateUrl;
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt + personaContext }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
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
  if (deeplink) {
    content += `\n\n이 포스팅은 제휴 마케팅 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.\n${deeplink}`;
  }

  const { data: post, error } = await supabase
    .from('ut_thread_posts')
    .insert({
      user_id: user.id,
      persona_id: body.personaIsSystem ? null : body.personaId || null,
      topic: body.topic || product?.productName || body.affiliateProductName || '',
      content,
      status: 'draft',
    })
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
