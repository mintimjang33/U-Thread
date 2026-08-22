import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';

// 공식 문서 기준: GET /{threads-user-id}/mentions, threads_manage_mentions 권한 필요.
// 앱이 심사 승인 전이면 "테스터가 언급한 것만" 반환됨(문서 명시).
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  if (!accountId) return NextResponse.json({ error: 'accountId가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: account } = await supabase
    .from('ut_threads_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: '연동된 Threads 계정을 찾을 수 없습니다.' }, { status: 404 });

  try {
    const accessToken = decryptVaultValue(account.encrypted_access_token);
    const fields = 'id,text,username,permalink,timestamp';
    const res = await fetch(
      `https://graph.threads.net/v1.0/${account.threads_user_id}/mentions?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`
    );
    const rawText = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(`Threads 응답을 해석하지 못했어요 (${res.status}): ${rawText.slice(0, 200) || '(빈 응답)'}`);
    }
    if (!res.ok) {
      const err = json.error as { message?: string } | undefined;
      throw new Error(err?.message || JSON.stringify(json));
    }
    return NextResponse.json({ mentions: (json.data as unknown[]) || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
