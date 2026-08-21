import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { decryptVaultValue, encryptVaultValue } from '../../../../lib/vaultCrypto';

// 장기 토큰(60일)은 만료 전에 갱신해야 한다. 필요할 때(연동 계정 목록 조회 등) 호출한다.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: account } = await supabase
    .from('ut_threads_accounts')
    .select('encrypted_access_token')
    .eq('id', body.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });

  const accessToken = decryptVaultValue(account.encrypted_access_token);
  const res = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${accessToken}`);
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    return NextResponse.json({ error: json.error_message || '토큰 갱신 실패' }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + (json.expires_in || 60 * 24 * 60 * 60) * 1000).toISOString();
  await supabase
    .from('ut_threads_accounts')
    .update({ encrypted_access_token: encryptVaultValue(json.access_token), token_expires_at: expiresAt })
    .eq('id', body.id)
    .eq('user_id', user.id);

  return NextResponse.json({ ok: true, expiresAt });
}
