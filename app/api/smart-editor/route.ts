import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';
import { getWorkerUserId } from '../../../lib/workerAuth';
import { decryptVaultValue } from '../../../lib/vaultCrypto';
import { coupangDeeplink } from '../../../lib/coupangApi';

// 쓰레드 바이럴 패턴(정보나열형/광고티 금지, 총정리·위트한줄·개인서사 3종 포맷,
// 첫 줄에 훅, 해시태그 2~3개, 외부링크 금지)을 시스템 프롬프트에 반영해서 글을 생성한다.
const BASE_SYSTEM_PROMPT = `너는 쓰레드(Threads) 바이럴 글쓰기 전문가다. 아래 규칙을 반드시 지켜라.

금지: 순수 정보나열형/백과사전 어투("~에 좋습니다/주의하세요" 식), 광고 티 나는 문구, 지어낸 경험담이나 검증 안 된 숫자.

실제로 반응 좋은 쓰레드 글을 비교분석해서 나온 원리(왜 통하는지):
- 첫 줄은 정보가 아니라 감정이다 — 확신("이건 절대 못참지"), 손실회피("없으면 손해보는"), 공포("헐 미친"), 애정/소속감("~ 절 받으세요") 중 하나로 시작해야 스크롤을 멈춘다. 상품명·정보는 그 다음이다.
- ⭐ 가장 강력한 훅은 "숫자로 증명된 성과 서사"다(위기→발견→극복→구체적 숫자 성과, 예: "망해가던 가게에서 5만개 팔아서 결혼한다"). 실측 비교 결과 이게 단순 감정소구(힘들다 등)보다 반응이 10배 이상 차이났다 — 실제 성과·숫자가 있으면 이 유형을 최우선으로 쓴다.
- 실수·위기를 투명하게 인정하는 글도 댓글 참여를 폭발시킨다(사람들이 위로·응원 댓글을 달게 됨) — 완벽한 척보다 솔직한 인정이 신뢰를 쌓는다.
- 문제→(제3자의)발견→해결의 완결된 미니 서사가 순수 정보나열보다 이탈률이 낮다.
- 문장은 짧게 끊고 이모지로 리듬을 준다. 막연한 얘기 대신 "빨래에 자꾸 쉰내가 나서"처럼 구체적 장면을 준다.
- 링크는 최대한 숨기거나 최소 노출한다(본문에 대놓고 걸면 광고로 인지돼 도달이 죽는다는 게 실전에서 검증됨) — 아래 few-shot 예시가 있으면 그 링크 처리 방식도 함께 참고할 것.
- 쓰레드 알고리즘은 좋아요보다 "첫 줄에서 스크롤이 멈췄는가"와 "팔로워 아닌 사람도 반응했는가"를 우선 본다 — 특정 팬층만 아는 얘기가 아니라 낯선 사람도 공감할 장면으로 써라.

허용 포맷 3종 중 하나로 작성:
1. 총정리/치트시트 — 압축된 정보를 리스트로 정리
2. 위트있는 한 줄 — 유행어/공감형 문구 + 검증 가능한 사실 하나
3. 개인 서사 — 실제로 있을 법한 자연스러운 경험 기반(과장된 숫자 금지)

형식: 첫 줄은 위 감정 원리 중 하나로 훅을 만들 것(정보/숫자로 시작 금지). 해시태그는 2~3개까지만.
결과는 JSON으로만 출력: {"content": "..."}`;

const RESULT_STYLE_ADDON: Record<string, string> = {
  basic: '',
  hook: '\n\n[결과 스타일: 검색/뷰 최적화] 첫 문장의 후킹력을 극대화해라 — 어그로성 질문, 반전, 숫자 충격을 적극 활용해서 클릭/스크롤을 멈추게 만들어라.',
  persona: '\n\n[결과 스타일: 내 페르소나] 아래 지정된 페르소나의 말투·어조를 다른 모든 규칙보다 최우선으로 강하게 반영해라. 페르소나 지침과 충돌하는 일반 규칙은 페르소나를 따른다.',
};

const MODE_ADDON: Record<string, string> = {
  casual: '',
  expert: '\n\n[작성 모드: 전문성글] 정보성 칼럼처럼 근거와 구조를 갖춰 전문적인 톤으로 작성해라. 가벼운 유머보다 신뢰도를 우선해라.',
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
  const workerUserId = await getWorkerUserId(request);
  const user = workerUserId ? null : await getCurrentUser();
  const userId = workerUserId || user?.id;
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const product = body?.product as Product | undefined;
  const affiliateUrl = body?.affiliateUrl as string | undefined;
  if (!body?.topic?.trim() && !product && !affiliateUrl) {
    return NextResponse.json({ error: 'topic, product, affiliateUrl 중 하나는 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // 직접 작성 모드: AI 생성 없이 입력한 텍스트를 그대로 초안으로 저장한다.
  if (body.mode === 'manual') {
    const { data: post, error } = await supabase
      .from('ut_thread_posts')
      .insert({
        user_id: userId,
        persona_id: body.personaIsSystem ? null : body.personaId || null,
        topic: body.topic || '',
        content: body.topic || '',
        status: 'draft',
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ post });
  }

  // 로컬 워커(클로드 구독) 사용 조건: 설정이 'worker'이고, 워커 전용 처리로 못 다루는 이미지/구글검색 그라운딩이 없을 때만.
  const { data: editorDefaults } = await supabase.from('ut_editor_defaults').select('ai_source').eq('user_id', userId).maybeSingle();
  const useWorker = editorDefaults?.ai_source === 'worker' && !body.mediaBase64 && body.googleSearch !== true;

  let apiKey = '';
  if (!useWorker) {
    const { data: keyRow } = await supabase
      .from('ut_api_keys_vault')
      .select('encrypted_values')
      .eq('user_id', userId)
      .eq('provider', 'GEMINI')
      .maybeSingle();

    const encryptedKey = keyRow?.encrypted_values?.apiKey;
    if (!encryptedKey) {
      return NextResponse.json({ error: 'Gemini API 키가 등록되어 있지 않습니다. /onboarding에서 먼저 등록해주세요.' }, { status: 400 });
    }
    apiKey = decryptVaultValue(encryptedKey);
  }

  let personaContext = '';
  if (body.personaIsSystem && body.personaId) {
    const { data: sp } = await supabase.from('ut_system_personas').select('prompt').eq('id', body.personaId).maybeSingle();
    if (sp) personaContext = `\n\n페르소나 스타일 지침:\n${sp.prompt}`;
  } else if (body.personaId) {
    const { data: persona } = await supabase.from('ut_personas').select('*').eq('id', body.personaId).eq('user_id', userId).maybeSingle();
    if (persona) {
      personaContext = `\n\n말투: ${persona.tone_prompt || '기본'}\n타겟: ${persona.target_prompt || '일반 독자'}`;
    }
  }

  // 실제로 반응이 검증된 글(ut_benchmark_items)을 few-shot 예시로 넣는다 —
  // 백지에서 지어내지 않고 이미 터진 글의 훅·구조·톤을 흉내내게 만들기 위함.
  const { data: benchmarks } = await supabase
    .from('ut_benchmark_items')
    .select('content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  let benchmarkContext = '';
  if (benchmarks && benchmarks.length > 0) {
    const sample = [...benchmarks].sort(() => Math.random() - 0.5).slice(0, 4);
    benchmarkContext =
      '\n\n아래는 실제로 반응이 좋았던 검증된 스레드 글 예시다. 그대로 베끼지 말고, 첫 줄 훅 방식·문장 길이·이모지 사용·타래 나누는 방식 같은 "패턴"만 참고해서 이번 주제에 맞게 새로 써라:\n' +
      sample.map((b, i) => `--- 예시 ${i + 1} ---\n${b.content}`).join('\n\n');
  }

  const resultStyle: string = ['basic', 'hook', 'persona'].includes(body.resultStyle) ? body.resultStyle : 'basic';
  const mode: string = ['casual', 'expert'].includes(body.mode) ? body.mode : 'casual';
  const threadSegments = Math.min(10, Math.max(1, Number(body.threadSegments) || 1));
  let systemPrompt = BASE_SYSTEM_PROMPT + RESULT_STYLE_ADDON[resultStyle] + MODE_ADDON[mode];
  if (threadSegments > 1) {
    systemPrompt += `\n\n[타래 다단 생성] 이 글은 총 ${threadSegments}개의 타래(스레드)로 이어서 발행돼야 한다. 위의 JSON 출력 규칙 대신, 아래 형식으로만 출력해라: {"segments": ["1번째 타래 내용", "2번째 타래 내용", ...]}. segments 배열은 반드시 정확히 ${threadSegments}개여야 하고, 각 타래는 앞뒤 맥락이 자연스럽게 이어지되 하나씩 읽어도 의미가 통해야 한다.`;
  }

  const complianceCategory = body.complianceCategory as string | undefined;
  if (complianceCategory && COMPLIANCE_RULES[complianceCategory]) {
    systemPrompt += `\n\n[안심 사전 심의필 모드] 다음 업종 광고 규정을 반드시 지켜서 순화된 문구로 작성해라(참고용 가이드이며 실제 법률 검토를 대체하지 않음을 유의):\n${COMPLIANCE_RULES[complianceCategory]}`;
  }

  let userPrompt = `주제: ${body.topic || ''}`;
  if (body.referenceText?.trim()) {
    userPrompt += `\n\n참고 자료:\n${body.referenceText.trim()}`;
  }
  let deeplink: string | null = null;

  if (product) {
    userPrompt = `아래 쿠팡 상품에 대한 리뷰형 쓰레드 글을 써줘.\n상품명: ${product.productName}\n가격: ${product.productPrice.toLocaleString()}원\n${body.topic ? `추가 강조할 내용: ${body.topic}` : ''}`;
    const { data: keyRow2 } = await supabase
      .from('ut_api_keys_vault')
      .select('encrypted_values')
      .eq('user_id', userId)
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

  const useGoogleSearch = body.googleSearch === true;
  const userParts: Record<string, unknown>[] = [{ text: userPrompt }];
  if (body.mediaBase64 && body.mediaMimeType) {
    userParts.push({ inlineData: { mimeType: body.mediaMimeType, data: body.mediaBase64 } });
  }

  let rawText: string;

  if (useWorker) {
    const combinedPrompt =
      `${systemPrompt}${personaContext}${benchmarkContext}\n\n---\n\n${userPrompt}\n\n(반드시 위 시스템 지침의 JSON 형식으로만 응답할 것. 다른 설명 텍스트 없이 JSON만 출력.)`;
    const { data: job, error: jobError } = await supabase
      .from('ut_worker_jobs')
      .insert({ user_id: userId, type: 'generate', input: { prompt: combinedPrompt } })
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
        systemInstruction: { parts: [{ text: systemPrompt + personaContext }] },
        contents: [{ role: 'user', parts: userParts }],
        // google_search 그라운딩은 responseMimeType:json과 함께 못 써서, 켜져 있으면 구조화 출력 강제를 빼고
        // 시스템 프롬프트의 "JSON으로만 출력" 지침 + 아래 폴백 파싱에 맡긴다.
        ...(useGoogleSearch ? { tools: [{ google_search: {} }] } : { generationConfig: { responseMimeType: 'application/json' } }),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({ error: `Gemini 요청 실패 (${res.status}): ${errText.slice(0, 300)}` }, { status: 500 });
    }

    const json = await res.json();
    rawText = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
  }
  let content = '';
  let extraSegments: string[] = [];
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed.segments) && parsed.segments.length > 0) {
      content = parsed.segments[0];
      extraSegments = parsed.segments.slice(1);
    } else {
      content = parsed.content;
    }
  } catch {
    content = rawText;
  }
  // 링크는 본문에 직접 넣지 않고 첫 댓글로 분리한다(실전 검증: 본문 링크는 광고로 인지돼 도달이 죽음).
  const affiliateComment = deeplink
    ? `${deeplink}\n\n쿠팡파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받습니다❤️`
    : null;

  const { data: post, error } = await supabase
    .from('ut_thread_posts')
    .insert({
      user_id: userId,
      persona_id: body.personaIsSystem ? null : body.personaId || null,
      topic: body.topic || product?.productName || body.affiliateProductName || '',
      content,
      thread_segments: extraSegments.length ? extraSegments : null,
      status: 'draft',
      affiliate_comment: affiliateComment,
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
