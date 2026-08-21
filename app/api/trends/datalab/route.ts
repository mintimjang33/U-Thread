import { NextResponse } from 'next/server';
import { naverKeywordTool, rankByVolume } from '../../../../lib/naverAdApi';

const CATEGORY_SEEDS: Record<string, string> = {
  '패션의류': '여성의류',
  '패션잡화': '가방',
  '화장품/미용': '스킨케어',
  '디지털/가전': '노트북',
  '가구/인테리어': '소파',
  '출산/육아': '유아용품',
  '식품': '간식',
  '스포츠/레저': '운동화',
  '생활/건강': '생활용품',
  '여가/생활편의': '캠핑용품',
  '도서': '베스트셀러',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || '패션의류';
  const seed = CATEGORY_SEEDS[category];
  if (!seed) return NextResponse.json({ error: '알 수 없는 카테고리입니다.' }, { status: 400 });

  const apiKey = process.env.NAVER_AD_API_KEY;
  const secretKey = process.env.NAVER_AD_SECRET_KEY;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID;
  if (!apiKey || !secretKey || !customerId) {
    return NextResponse.json({ error: '네이버 검색광고 API가 서버에 설정되지 않았어요.' }, { status: 500 });
  }

  try {
    const keywords = await naverKeywordTool(apiKey, secretKey, customerId, seed);
    const ranked = rankByVolume(keywords, 20);
    return NextResponse.json({ category, seed, keywords: ranked, syncedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
