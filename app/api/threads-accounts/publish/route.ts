import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.postId) return NextResponse.json({ error: 'postId가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: post } = await supabase
    .from('ut_thread_posts')
    .select('*')
    .eq('id', body.postId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });

  const accountId = body.threadsAccountId || post.threads_account_id;
  if (!accountId) return NextResponse.json({ error: '발행할 Threads 계정을 선택해주세요.' }, { status: 400 });

  const { data: account } = await supabase
    .from('ut_threads_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: '연동된 Threads 계정을 찾을 수 없습니다.' }, { status: 404 });

  const accessToken = decryptVaultValue(account.encrypted_access_token);

  try {
    const createRes = await fetch(`https://graph.threads.net/v1.0/${account.threads_user_id}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'TEXT', text: post.content, access_token: accessToken }),
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

    await supabase
      .from('ut_thread_posts')
      .update({ status: 'posted', threads_account_id: accountId })
      .eq('id', post.id)
      .eq('user_id', user.id);

    return NextResponse.json({ ok: true, threadsPostId: publishJson.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `발행 실패: ${message}` }, { status: 500 });
  }
}
