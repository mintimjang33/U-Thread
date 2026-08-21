import { NextResponse } from 'next/server';

// TODO: Supabase 연결 후 실제 테이블(revenue_posts)로 교체.
type RevenuePost = { id: string; title: string; amount: number; content: string; created_at: string; likes: number; views: number };
const memoryStore: RevenuePost[] = [];

export async function GET() {
  return NextResponse.json({ posts: [...memoryStore].reverse() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !body.title?.trim() || !body.amount) {
    return NextResponse.json({ error: 'title/amount가 필요합니다.' }, { status: 400 });
  }
  const post: RevenuePost = {
    id: crypto.randomUUID(),
    title: body.title,
    amount: Number(body.amount),
    content: body.content || '',
    created_at: new Date().toISOString(),
    likes: 0,
    views: 0,
  };
  memoryStore.push(post);
  return NextResponse.json({ post });
}
