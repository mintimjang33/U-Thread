import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../../lib/supabase';
import { getCurrentUser } from '../../../../../lib/supabaseServerAuth';
import { isAdminUser } from '../../../../../lib/subscription';

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || !isAdminUser(admin.id)) {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const targetUserId = body?.userId as string | undefined;
  const action = body?.action as 'grant' | 'revoke' | undefined;
  const days = Number(body?.days) || 30;
  if (!targetUserId || !action) {
    return NextResponse.json({ error: 'userId/action이 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  if (action === 'grant') {
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('ut_subscriptions')
      .upsert({ user_id: targetUserId, is_subscribed: true, expires_at: expiresAt, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, expiresAt });
  }

  const { error } = await supabase
    .from('ut_subscriptions')
    .upsert({ user_id: targetUserId, is_subscribed: false, expires_at: null, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
