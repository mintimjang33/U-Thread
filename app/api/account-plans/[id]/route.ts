import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';

const FIELDS = [
  'label',
  'target_age',
  'target_gender',
  'category',
  'step_gmail',
  'step_instagram',
  'step_subaccount',
  'step_threads_connected',
  'persona_id',
  'persona_is_system',
  'notes',
  'backstory',
  'suggested_handle',
  'sort_order',
  'ratio_daily',
  'ratio_shopping',
  'viral_view_threshold',
  'viral_unlocked',
  'mission_cycle_position',
];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: '요청 본문이 필요합니다.' }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (f in body) update[f] = body[f];

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_account_plans')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plan: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('ut_account_plans').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
