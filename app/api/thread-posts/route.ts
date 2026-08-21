import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data: posts, error } = await supabase
    .from('ut_thread_posts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'posted')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accountIds = Array.from(new Set((posts || []).map((p) => p.threads_account_id).filter(Boolean)));
  let accountsById: Record<string, string> = {};
  if (accountIds.length) {
    const { data: accounts } = await supabase
      .from('ut_threads_accounts')
      .select('id, username, threads_user_id')
      .in('id', accountIds);
    accountsById = Object.fromEntries((accounts || []).map((a) => [a.id, a.username || a.threads_user_id]));
  }

  const enriched = (posts || []).map((p) => ({ ...p, account_username: accountsById[p.threads_account_id] || null }));
  return NextResponse.json({ posts: enriched });
}
