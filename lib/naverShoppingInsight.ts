// 네이버 데이터랩 쇼핑인사이트 API — 네이버가 2026-07-31부로 구버전 개발자센터(openapi.naver.com)
// 신규 신청을 막고 NAVER API HUB(naverapihub.apigw.ntruss.com)로 이관했다.
// 인증 헤더/엔드포인트가 구버전과 다름(X-NCP-APIGW-API-KEY-ID/KEY, /shopping/v1/categories).
// 카테고리별 검색 클릭 추이(상대지수, 0~100)를 최근 기간으로 조회한다.
const CATEGORY_CODES: Record<string, string> = {
  '패션의류': '50000000',
  '패션잡화': '50000001',
  '화장품/미용': '50000002',
  '디지털/가전': '50000003',
  '가구/인테리어': '50000004',
  '출산/육아': '50000005',
  '식품': '50000006',
  '스포츠/레저': '50000007',
  '생활/건강': '50000008',
  '여가/생활편의': '50000009',
  '도서': '50005542',
};

export type ShoppingTrendPoint = { period: string; ratio: number };

export async function getShoppingInsight(clientId: string, clientSecret: string, category: string): Promise<ShoppingTrendPoint[]> {
  const categoryCode = CATEGORY_CODES[category];
  if (!categoryCode) throw new Error(`알 수 없는 카테고리: ${category}`);

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await fetch('https://naverapihub.apigw.ntruss.com/shopping/v1/categories', {
    method: 'POST',
    headers: {
      'X-NCP-APIGW-API-KEY-ID': clientId,
      'X-NCP-APIGW-API-KEY': clientSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      timeUnit: 'date',
      category: [{ name: category, param: [categoryCode] }],
    }),
  });
  if (!res.ok) throw new Error(`네이버 쇼핑인사이트 조회 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const data = json.results?.[0]?.data || [];
  return data.map((d: { period: string; ratio: number }) => ({ period: d.period, ratio: d.ratio }));
}

export const SHOPPING_CATEGORIES = Object.keys(CATEGORY_CODES);
