import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getWorkerUserId } from '../../../../lib/workerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';

// 로컬 워커가 "제미나이로 생성" 모드일 때 쓰는 전용 통로 — 워커는 원본 API 키를 절대 못 보고,
// 이미 완성된 프롬프트 문자열만 보내면 서버가 저장해둔 키로 대신 호출해서 결과 텍스트만 돌려준다.
export async function POST(request: Request) {
  const userId = await getWorkerUserId(request);
  if (!userId) return NextResponse.json({ error: '워커 인증이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const prompt = body?.prompt?.trim();
  if (!prompt) return NextResponse.json({ error: 'prompt가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: keyRow } = await supabase
    .from('ut_api_keys_vault')
    .select('encrypted_values')
    .eq('user_id', userId)
    .eq('provider', 'GEMINI')
    .maybeSingle();
  const encryptedKey = keyRow?.encrypted_values?.apiKey;
  if (!encryptedKey) {
    return NextResponse.json({ error: 'Gemini API 키가 등록되어 있지 않습니다. 유쓰레드 웹 대시보드에서 먼저 등록해주세요.' }, { status: 400 });
  }
  const apiKey = decryptVaultValue(encryptedKey);

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return NextResponse.json({ error: `Gemini 요청 실패 (${res.status}): ${errText.slice(0, 300)}` }, { status: 500 });
  }
  const json = await res.json();
  const content = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
  return NextResponse.json({ content });
}
