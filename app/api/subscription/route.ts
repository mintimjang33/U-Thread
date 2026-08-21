import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from('ut_subscriptions').select('*').eq('user_id', user.id).maybeSingle();

  const isSubscribed = !!data?.is_subscribed && (!data.expires_at || new Date(data.expires_at) > new Date());
  return NextResponse.json({ isSubscribed, expiresAt: data?.expires_at || null });
}

// TODO: 토스페이먼츠 정기결제(빌링키) 연동 전까지는, "구독하기"를 누르면 결제 없이
// 30일/365일짜리 프리미엄을 임시로 부여한다(실 결제 아님을 UI에 명시할 것).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const plan = body?.plan === 'yearly' ? 'yearly' : 'monthly';
  const days = plan === 'yearly' ? 365 : 30;

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('ut_subscriptions')
    .upsert({ user_id: user.id, is_subscribed: true, expires_at: expiresAt, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, expiresAt, plan });
}
