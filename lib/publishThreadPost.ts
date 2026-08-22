import { getSupabaseServerClient } from './supabase';
import { decryptVaultValue } from './vaultCrypto';

type ThreadPost = { id: string; content: string; affiliate_comment: string | null; share_to_instagram?: boolean };
type ThreadsAccount = { threads_user_id: string; encrypted_access_token: string };

// 실제 Threads Graph API로 게시물(+제휴 타래가 있으면 답글까지)을 발행한다.
// /write, /multi-write의 수동 발행 버튼과 예약발행 크론 잡이 공유해서 쓰는 핵심 로직.
export async function publishThreadPostNow(post: ThreadPost, account: ThreadsAccount): Promise<{ threadsPostId: string }> {
  const accessToken = decryptVaultValue(account.encrypted_access_token);

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
    body: JSON.stringify({
      creation_id: createJson.id,
      access_token: accessToken,
      ...(post.share_to_instagram ? { crossreshare_to_ig: true } : {}),
    }),
  });
  const publishJson = await publishRes.json();
  if (!publishRes.ok || !publishJson.id) throw new Error(publishJson.error?.message || JSON.stringify(publishJson));

  if (post.affiliate_comment?.trim()) {
    const replyCreateRes = await fetch(`https://graph.threads.net/v1.0/${account.threads_user_id}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: post.affiliate_comment,
        reply_to_id: publishJson.id,
        access_token: accessToken,
      }),
    });
    const replyCreateJson = await replyCreateRes.json();
    if (replyCreateRes.ok && replyCreateJson.id) {
      await fetch(`https://graph.threads.net/v1.0/${account.threads_user_id}/threads_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: replyCreateJson.id, access_token: accessToken }),
      });
      // 제휴 타래 발행 실패는 본문 발행 성공을 무효화하지 않는다.
    }
  }

  return { threadsPostId: publishJson.id };
}

// 예약 대기 중이던 글에 대해 계정을 조회하고 발행-상태갱신까지 한 번에 처리한다.
export async function publishScheduledPost(postId: string) {
  const supabase = getSupabaseServerClient();
  const { data: post } = await supabase.from('ut_thread_posts').select('*').eq('id', postId).maybeSingle();
  if (!post) throw new Error('글을 찾을 수 없습니다.');
  if (!post.threads_account_id) throw new Error('발행할 Threads 계정이 지정되어 있지 않습니다.');

  const { data: account } = await supabase.from('ut_threads_accounts').select('*').eq('id', post.threads_account_id).maybeSingle();
  if (!account) throw new Error('연동된 Threads 계정을 찾을 수 없습니다.');

  await supabase.from('ut_thread_posts').update({ status: 'publishing' }).eq('id', postId);

  try {
    const result = await publishThreadPostNow(post, account);
    await supabase
      .from('ut_thread_posts')
      .update({ status: 'posted', publish_error: null, threads_post_id: result.threadsPostId })
      .eq('id', postId);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from('ut_thread_posts').update({ status: 'failed', publish_error: message }).eq('id', postId);
    throw err;
  }
}
