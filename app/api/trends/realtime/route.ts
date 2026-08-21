import { NextResponse } from 'next/server';
import { searchNaverNews } from '../../../../lib/naverNews';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '오늘 이슈';

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: '네이버 뉴스 검색 API가 서버에 설정되지 않았어요.' }, { status: 500 });
  }

  try {
    const items = await searchNaverNews(clientId, clientSecret, query, 15);
    return NextResponse.json({ items, syncedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
