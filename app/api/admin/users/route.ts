import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { isAdminUser } from '../../../../lib/subscription';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user.id)) {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  const [{ data: authData, error: authError }, { data: subs }] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 200 }),
    supabase.from('ut_subscriptions').select('*'),
  ]);
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const subByUser = new Map((subs || []).map((s) => [s.user_id, s]));

  const users = authData.users
    .map((u) => {
      const sub = subByUser.get(u.id);
      const isSubscribed = !!sub?.is_subscribed && (!sub.expires_at || new Date(sub.expires_at) > new Date());
      return {
        id: u.id,
        email: u.email || '',
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at || null,
        isAdmin: isAdminUser(u.id),
        isSubscribed,
        expiresAt: sub?.expires_at || null,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ users });
}
