import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../../lib/supabase';
import { getCurrentUser } from '../../../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../../../lib/vaultCrypto';

// 언급(mention)된 공개 게시물에 답글을 단다 — reply_to_id로 컨테이너 생성 후 발행.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { accountId, mentionId, text } = body || {};
  if (!accountId || !mentionId || !text?.trim()) {
    return NextResponse.json({ error: 'accountId/mentionId/text가 필요합니다.' }, { status: 400 });
  }

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
    const createRes = await fetch(`https://graph.threads.net/v1.0/${account.threads_user_id}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'TEXT', text, reply_to_id: mentionId, access_token: accessToken }),
    });
    const createJson = await createRes.json();
    if (!createRes.ok || !createJson.id) throw new Error(createJson.error?.message || JSON.stringify(createJson));

    const publishRes = await fetch(`https://graph.threads.net/v1.0/${account.threads_user_id}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: createJson.id, access_token: accessToken }),
    });
    const publishJson = await publishRes.json();
    if (!publishRes.ok || !publishJson.id) throw new Error(publishJson.error?.message || JSON.stringify(publishJson));

    return NextResponse.json({ ok: true, replyId: publishJson.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
