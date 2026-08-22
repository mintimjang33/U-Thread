import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';
import { THREADS_SCOPES } from '../../../../lib/threadsScopes';

// Threads가 공식 문서화하진 않았지만 실제로 동작하는 debug_token 엔드포인트로
// 이 계정 토큰에 실제 부여된 scope 목록을 조회해서, 연동 화면에서 권한별 상태를 보여준다.
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

  const accessToken = decryptVaultValue(account.encrypted_access_token);

  try {
    const res = await fetch(
      `https://graph.threads.net/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(accessToken)}`
    );
    const rawText = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch {
      return NextResponse.json({ supported: false, message: 'Threads가 권한 상세 조회를 지원하지 않아요.' });
    }
    if (!res.ok) {
      return NextResponse.json({ supported: false, message: (json.error as { message?: string })?.message || '권한 조회 실패' });
    }

    const data = json.data as { scopes?: string[] } | undefined;
    const grantedScopes = data?.scopes || [];
    if (grantedScopes.length === 0) {
      return NextResponse.json({ supported: false, message: 'Threads가 권한 목록을 반환하지 않았어요.' });
    }

    const scopes = THREADS_SCOPES.map((s) => ({ ...s, granted: grantedScopes.includes(s.key) }));
    return NextResponse.json({ supported: true, scopes });
  } catch (err) {
    return NextResponse.json({ supported: false, message: err instanceof Error ? err.message : String(err) });
  }
}
