import crypto from 'node:crypto';

const BASE_URL = 'https://api.naver.com';

function sign(method: string, path: string, secretKey: string) {
  const timestamp = Date.now().toString();
  const message = `${timestamp}.${method}.${path}`;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  return { timestamp, signature };
}

export type NaverKeyword = {
  relKeyword: string;
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
};

// 네이버 검색광고 키워드도구 API — 시드 키워드를 넣으면 연관 키워드 + 월간 검색량을 돌려준다.
// (진짜 실시간 트렌드 랭킹은 아니고, 시드 키워드 기반 연관어 확장 + 검색량 정렬)
export async function naverKeywordTool(apiKey: string, secretKey: string, customerId: string, hintKeywords: string) {
  const path = '/keywordstool';
  const { timestamp, signature } = sign('GET', path, secretKey);
  const url = `${BASE_URL}${path}?hintKeywords=${encodeURIComponent(hintKeywords)}&showDetail=1`;

  const res = await fetch(url, {
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': apiKey,
      'X-Customer': customerId,
      'X-Signature': signature,
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`네이버 검색광고 API 실패 (${res.status}): ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.keywordList || []) as NaverKeyword[];
}

function toNumber(v: number | string): number {
  if (typeof v === 'number') return v;
  if (v === '< 10') return 5;
  return Number(v) || 0;
}

export function rankByVolume(keywords: NaverKeyword[], limit = 20) {
  return keywords
    .map((k) => ({
      keyword: k.relKeyword,
      volume: toNumber(k.monthlyPcQcCnt) + toNumber(k.monthlyMobileQcCnt),
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);
}
