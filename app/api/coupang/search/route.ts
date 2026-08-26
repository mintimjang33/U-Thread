import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { getWorkerUserId } from '../../../../lib/workerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';
import { coupangSearchProducts } from '../../../../lib/coupangApi';

export async function GET(request: Request) {
  const workerUserId = await getWorkerUserId(request);
  const user = workerUserId ? null : await getCurrentUser();
  const userId = workerUserId || user?.id;
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  if (!keyword?.trim()) return NextResponse.json({ error: 'keyword가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: keyRow } = await supabase
    .from('ut_api_keys_vault')
    .select('encrypted_values')
    .eq('user_id', userId)
    .eq('provider', 'COUPANG')
    .maybeSingle();
  const encrypted = keyRow?.encrypted_values as { accessKey?: string; secretKey?: string } | undefined;
  if (!encrypted?.accessKey || !encrypted?.secretKey) {
    return NextResponse.json({ error: '쿠팡파트너스 API 키가 등록되어 있지 않습니다. [쿠파스 API 연결] 탭에서 먼저 등록해주세요.' }, { status: 400 });
  }

  try {
    const accessKey = decryptVaultValue(encrypted.accessKey);
    const secretKey = decryptVaultValue(encrypted.secretKey);
    const products = await coupangSearchProducts(accessKey, secretKey, keyword);
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
