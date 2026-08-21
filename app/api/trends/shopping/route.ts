import { NextResponse } from 'next/server';
import { getShoppingInsight } from '../../../../lib/naverShoppingInsight';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || '패션의류';

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: '네이버 데이터랩 API가 서버에 설정되지 않았어요.' }, { status: 500 });
  }

  try {
    const points = await getShoppingInsight(clientId, clientSecret, category);
    return NextResponse.json({ category, points, syncedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
