import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';

export async function GET() {
  const supabase = getSupabaseServerClient();
  // 수익 인증 라운지는 커뮤니티 게시판(원본도 무료·공개)이라 전체 유저 글을 다 보여준다.
  const { data, error } = await supabase.from('ut_revenue_posts').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !body.title?.trim() || !body.amount) {
    return NextResponse.json({ error: 'title/amount가 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_revenue_posts')
    .insert({ user_id: user.id, title: body.title, amount: Number(body.amount), content: body.content || '' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: data });
}
