import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { getWorkerUserId } from '../../../../lib/workerAuth';
import { publishThreadPostNow } from '../../../../lib/publishThreadPost';

export async function POST(request: Request) {
  const workerUserId = await getWorkerUserId(request);
  const user = workerUserId ? null : await getCurrentUser();
  const userId = workerUserId || user?.id;
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.postId) return NextResponse.json({ error: 'postId가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: post } = await supabase
    .from('ut_thread_posts')
    .select('*')
    .eq('id', body.postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });

  const accountId = body.threadsAccountId || post.threads_account_id;
  if (!accountId) return NextResponse.json({ error: '발행할 Threads 계정을 선택해주세요.' }, { status: 400 });

  const { data: account } = await supabase
    .from('ut_threads_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: '연동된 Threads 계정을 찾을 수 없습니다.' }, { status: 404 });

  const shareToInstagram = typeof body.shareToInstagram === 'boolean' ? body.shareToInstagram : post.share_to_instagram;

  try {
    const result = await publishThreadPostNow({ ...post, share_to_instagram: shareToInstagram }, account);

    await supabase
      .from('ut_thread_posts')
      .update({
        status: 'posted',
        threads_account_id: accountId,
        publish_error: null,
        threads_post_id: result.threadsPostId,
        share_to_instagram: shareToInstagram,
      })
      .eq('id', post.id)
      .eq('user_id', userId);

    return NextResponse.json({ ok: true, threadsPostId: result.threadsPostId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from('ut_thread_posts').update({ status: 'failed', publish_error: message }).eq('id', post.id).eq('user_id', userId);
    return NextResponse.json({ error: `발행 실패: ${message}` }, { status: 500 });
  }
}
