import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';

const EXTRACT_SYSTEM_PROMPT = `너는 글쓰기 스타일 분석가다. 주어진 텍스트의 말투/어조/문장 습관/소재 선택 패턴을 분석해서,
다른 사람이 이 스타일로 글을 쓸 수 있도록 하는 "페르소나 프롬프트 지침"을 만들어라.
지침은 실제 예시 문구, 어미(반말/존댓말), 자주 쓰는 감탄사나 이모지, 문장 길이, 소재 경향을 구체적으로 담아야 한다.
결과는 JSON으로만 출력: {"name": "짧은 페르소나 이름(15자 이내)", "prompt": "스타일 지침 (불릿 - 로 3~5개)"}`;

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i');
  const match = html.match(re);
  return match ? match[1] : null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
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

  let sourceText = '';

  if (body?.mode === 'benchmark') {
    if (!body.benchmarkItemId) return NextResponse.json({ error: 'benchmarkItemId가 필요합니다.' }, { status: 400 });
    const { data: item } = await supabase
      .from('ut_benchmark_items')
      .select('content')
      .eq('id', body.benchmarkItemId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!item?.content) return NextResponse.json({ error: '해당 벤치마킹 글을 찾을 수 없습니다.' }, { status: 404 });
    sourceText = item.content;
  } else if (body?.mode === 'profile') {
    const handle = (body.handle || '').replace(/^@/, '').trim();
    if (!handle) return NextResponse.json({ error: 'Threads 계정 핸들이 필요합니다.' }, { status: 400 });
    try {
      const res = await fetch(`https://www.threads.net/@${handle}`, {
        headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
      });
      const html = await res.text();
      const bio = extractMeta(html, 'og:description');
      if (!bio) {
        return NextResponse.json(
          { error: '이 계정에서 스타일을 분석할 만한 공개 텍스트를 가져오지 못했어요. "벤치마킹에서 추출"을 이용해주세요.' },
          { status: 422 }
        );
      }
      sourceText = bio;
    } catch {
      return NextResponse.json({ error: '계정을 조회하지 못했어요. 핸들을 확인해주세요.' }, { status: 502 });
    }
  } else {
    return NextResponse.json({ error: 'mode는 benchmark 또는 profile 이어야 합니다.' }, { status: 400 });
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: EXTRACT_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: sourceText }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return NextResponse.json({ error: `Gemini 요청 실패 (${res.status}): ${errText.slice(0, 300)}` }, { status: 500 });
  }
  const json = await res.json();
  const rawText = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
  let parsed: { name?: string; prompt?: string } = {};
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { name: '', prompt: rawText };
  }

  return NextResponse.json({ name: parsed.name || '', prompt: parsed.prompt || '' });
}
