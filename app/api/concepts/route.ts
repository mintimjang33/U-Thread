import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_saved_concepts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ concepts: data || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.label?.trim()) return NextResponse.json({ error: 'label이 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_saved_concepts')
    .insert({
      user_id: user.id,
      label: body.label,
      daily: Array.isArray(body.daily) ? body.daily : [],
      intro: Array.isArray(body.intro) ? body.intro : [],
      backstory: body.backstory || null,
      persona_name: body.persona_name || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ concept: data });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('ut_saved_concepts').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
