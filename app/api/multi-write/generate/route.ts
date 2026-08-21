import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';
import { coupangDeeplink } from '../../../../lib/coupangApi';

const SYSTEM_PROMPT = `너는 쓰레드(Threads) 바이럴 글쓰기 전문가다. 아래 규칙을 반드시 지켜라.

금지: 순수 정보나열형/백과사전 어투("~에 좋습니다/주의하세요" 식), 광고 티 나는 문구, 지어낸 경험담이나 검증 안 된 숫자.

허용 포맷 3종 중 하나로 작성:
1. 총정리/치트시트 — 압축된 정보를 리스트로 정리
2. 위트있는 한 줄 — 유행어/공감형 문구 + 검증 가능한 사실 하나
3. 개인 서사 — 실제로 있을 법한 자연스러운 경험 기반(과장된 숫자 금지)

형식: 첫 줄에 숫자·의외성·질문 중 하나로 훅을 만들 것. 본문에 외부 링크 넣지 말 것. 해시태그는 2~3개까지만.
결과는 JSON으로만 출력: {"content": "..."}`;

type AccountPersona = { accountId: string; personaId: string | null; personaIsSystem: boolean };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const accountPersonas: AccountPersona[] = body?.accounts || [];
  const product = body?.product as { productName: string; productPrice: number; productUrl: string } | undefined;
  if (!accountPersonas.length) return NextResponse.json({ error: '발행 계정을 선택해주세요.' }, { status: 400 });
  if (!body?.topic?.trim() && !product) return NextResponse.json({ error: 'topic 또는 product가 필요합니다.' }, { status: 400 });

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
        deeplink = null; // 딥링크 생성 실패해도 본문 생성은 계속 진행
      }
    }
  }

  const results: { accountId: string; postId?: string; error?: string }[] = [];

  for (const ap of accountPersonas) {
    let personaContext = '';
    if (ap.personaId) {
      if (ap.personaIsSystem) {
        const { data: sp } = await supabase.from('ut_system_personas').select('prompt').eq('id', ap.personaId).maybeSingle();
        if (sp) personaContext = `\n\n페르소나 스타일 지침:\n${sp.prompt}`;
      } else {
        const { data: p } = await supabase.from('ut_personas').select('*').eq('id', ap.personaId).eq('user_id', user.id).maybeSingle();
        if (p) personaContext = `\n\n말투: ${p.tone_prompt || '기본'}\n타겟: ${p.target_prompt || '일반 독자'}`;
      }
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT + personaContext }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini 요청 실패 (${res.status}): ${errText.slice(0, 200)}`);
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
        content += `\n\n이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.\n${deeplink}`;
      }

      const { data: post, error } = await supabase
        .from('ut_thread_posts')
        .insert({
          user_id: user.id,
          persona_id: ap.personaIsSystem ? null : ap.personaId,
          threads_account_id: ap.accountId,
          topic: body.topic,
          content,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      results.push({ accountId: ap.accountId, postId: post.id });
    } catch (err) {
      results.push({ accountId: ap.accountId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ results });
}
