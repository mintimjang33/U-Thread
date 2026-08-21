import { NextResponse } from 'next/server';

// TODO: Supabase 프로젝트 연결 후 실제 테이블(benchmark_items)로 교체할 것.
// 지금은 Supabase 없이도 UI를 바로 확인해볼 수 있도록 메모리에 임시 저장한다(서버 재시작하면 사라짐).
type BenchmarkItem = { id: string; source: string; content: string; created_at: string };
const memoryStore: BenchmarkItem[] = [];

export async function GET() {
  return NextResponse.json({ items: [...memoryStore].reverse() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !body.content?.trim()) {
    return NextResponse.json({ error: 'content가 필요합니다.' }, { status: 400 });
  }
  const item: BenchmarkItem = {
    id: crypto.randomUUID(),
    source: body.source || '',
    content: body.content,
    created_at: new Date().toISOString(),
  };
  memoryStore.push(item);
  return NextResponse.json({ item });
}
