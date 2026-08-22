import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { decryptVaultValue } from '../../../../lib/vaultCrypto';

// Threads 원본 게시물을 실제로 삭제한다. 공식 문서 기준 DELETE /v1.0/{threads-media-id},
// threads_delete 권한 필요, 계정당 하루 100개 삭제 제한.
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
  if (!post.threads_post_id) {
    return NextResponse.json({ error: 'Threads에 발행된 기록이 없어 삭제할 수 없습니다.' }, { status: 400 });
  }

  const { data: account } = await supabase
    .from('ut_threads_accounts')
    .select('*')
    .eq('id', post.threads_account_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: '연동된 Threads 계정을 찾을 수 없습니다.' }, { status: 404 });

  try {
    const accessToken = decryptVaultValue(account.encrypted_access_token);
    const res = await fetch(
      `https://graph.threads.net/v1.0/${post.threads_post_id}?access_token=${encodeURIComponent(accessToken)}`,
      { method: 'DELETE' }
    );
    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.error?.message || JSON.stringify(json));
    }

    await supabase.from('ut_thread_posts').delete().eq('id', post.id).eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `삭제 실패: ${message}` }, { status: 500 });
  }
}
