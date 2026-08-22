import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // 없으면 전체
  const accountId = searchParams.get('accountId');
  const search = searchParams.get('search');

  const supabase = getSupabaseServerClient();
  let query = supabase.from('ut_thread_posts').select('*').eq('user_id', user.id);
  if (status) query = query.eq('status', status);
  if (accountId) query = query.eq('threads_account_id', accountId);
  if (search) query = query.ilike('content', `%${search}%`);
  const { data: posts, error } = await query.order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: accounts } = await supabase
    .from('ut_threads_accounts')
    .select('id, username, threads_user_id')
    .eq('user_id', user.id);
  const accountsById = Object.fromEntries((accounts || []).map((a) => [a.id, a.username || a.threads_user_id]));

  const enriched = (posts || []).map((p) => ({ ...p, account_username: accountsById[p.threads_account_id] || null }));

  // 상태별 카운트(전체 게시물 기준, 필터 무관)
  const { data: allPosts } = await supabase.from('ut_thread_posts').select('status').eq('user_id', user.id);
  const statusCounts: Record<string, number> = { draft: 0, scheduled: 0, publishing: 0, posted: 0, failed: 0 };
  for (const p of allPosts || []) {
    if (p.status in statusCounts) statusCounts[p.status]++;
  }

  return NextResponse.json({ posts: enriched, accounts: accounts || [], statusCounts });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('ut_thread_posts')
    .update({ affiliate_comment: body.affiliateComment ?? null })
    .eq('id', body.id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
