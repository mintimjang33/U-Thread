import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getWorkerUserId } from '../../../../lib/workerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';
import { coupangSearchProducts } from '../../../../lib/coupangApi';

// 워커 전용 — 쿠팡 파트너스 키가 실제로 유효한지 확인만 하고, 원본 키는 워커에 절대 넘기지 않는다
// (generate-gemini와 동일한 보안 패턴: 서버가 볼트를 복호화해서 직접 호출).
export async function POST(request: Request) {
  const workerUserId = await getWorkerUserId(request);
  if (!workerUserId) return NextResponse.json({ error: '워커 인증이 필요합니다.' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data: keyRow } = await supabase
    .from('ut_api_keys_vault')
    .select('encrypted_values')
    .eq('user_id', workerUserId)
    .eq('provider', 'COUPANG')
    .maybeSingle();
  const encrypted = keyRow?.encrypted_values as { accessKey?: string; secretKey?: string } | undefined;
  if (!encrypted?.accessKey || !encrypted?.secretKey) {
    return NextResponse.json({ error: '쿠팡파트너스 API 키가 등록되어 있지 않습니다.' }, { status: 400 });
  }

  try {
    const accessKey = decryptVaultValue(encrypted.accessKey);
    const secretKey = decryptVaultValue(encrypted.secretKey);
    const products = await coupangSearchProducts(accessKey, secretKey, '테스트', 1);
    return NextResponse.json({ ok: true, sample: products[0]?.productName || null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
