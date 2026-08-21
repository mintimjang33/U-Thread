import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = 20;

  const supabase = getSupabaseServerClient();

  const { data: categoryRows } = await supabase.from('ut_archive_videos').select('category');
  const categoryCounts: Record<string, number> = {};
  for (const row of categoryRows || []) {
    categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
  }

  let query = supabase.from('ut_archive_videos').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (category) query = query.eq('category', category);
  if (search) query = query.ilike('title', `%${search}%`);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ videos: data || [], total: count || 0, page, pageSize, categoryCounts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.category?.trim() || !body?.title?.trim() || !body?.videoUrl?.trim()) {
    return NextResponse.json({ error: 'category, title, videoUrl이 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_archive_videos')
    .insert({
      uploader_id: user.id,
      category: body.category,
      title: body.title,
      hashtags: Array.isArray(body.hashtags) ? body.hashtags : [],
      video_url: body.videoUrl,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ video: data });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('ut_archive_videos').delete().eq('id', id).eq('uploader_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
