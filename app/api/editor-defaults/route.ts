import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';

const DEFAULTS = {
  vision_analysis: true,
  google_search: true,
  thread_segments: 1,
  relay_delay: false,
  default_persona_id: null as string | null,
  default_persona_is_system: true,
  default_affiliate_template_id: null as string | null,
  coupang_auto_image: true,
  toss_auto_image: true,
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from('ut_editor_defaults').select('*').eq('user_id', user.id).maybeSingle();

  return NextResponse.json({ defaults: data || DEFAULTS });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: '요청 본문이 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_editor_defaults')
    .upsert({ user_id: user.id, ...body, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ defaults: data });
}
