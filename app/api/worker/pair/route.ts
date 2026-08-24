import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_worker_pairing')
    .select('id, label, last_seen_at, created_at, expires_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pairings: data || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  // 이용권 코드 형식(예: UT1-A1B2C3D4-E5F6G) — 참고한 반자동 앱의 "TC1-XXXXXXXX-XXXXX" 형식과 동일한 발상.
  const part1 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
  const token = `UT1-${part1}-${part2}`;

  const durationDays = Number(body?.durationDays);
  const expiresAt = durationDays > 0 ? new Date(Date.now() + durationDays * 86400000).toISOString() : null;

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('ut_worker_pairing').insert({ user_id: user.id, token, label: body?.label || null, expires_at: expiresAt });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 토큰은 발급 시 이 응답으로만 노출된다 — 이후엔 절대 다시 보여주지 않는다.
  return NextResponse.json({ token });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('ut_worker_pairing').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
