import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_account_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plans: data || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.label?.trim()) return NextResponse.json({ error: 'label이 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_account_plans')
    .insert({
      user_id: user.id,
      label: body.label,
      target_age: body.target_age || null,
      target_gender: body.target_gender || null,
      category: body.category || null,
      persona_id: body.persona_id || null,
      persona_is_system: !!body.persona_is_system,
      notes: body.notes || null,
      backstory: body.backstory || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plan: data });
}
