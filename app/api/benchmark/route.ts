import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folder_id'); // 'unfiled' | uuid | null(=전체)

  const supabase = getSupabaseServerClient();
  let query = supabase.from('ut_benchmark_items').select('*').eq('user_id', user.id);
  if (folderId === 'unfiled') query = query.is('folder_id', null);
  else if (folderId) query = query.eq('folder_id', folderId);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !body.content?.trim()) {
    return NextResponse.json({ error: 'content가 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_benchmark_items')
    .insert({
      user_id: user.id,
      source: body.source || '',
      content: body.content,
      folder_id: body.folder_id || null,
      media_url: body.media_url || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ids: string[] = body?.ids || [];
  if (!ids.length) return NextResponse.json({ error: 'ids가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('ut_benchmark_items').delete().eq('user_id', user.id).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
