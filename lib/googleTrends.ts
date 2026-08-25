export type TrendItem = { title: string; trafficLabel: string | null };

// Google Trends 공식 오픈API는 없어서, 구글이 자체 대시보드에 쓰는 공개 RSS 피드를 사용한다.
// (비공식이지만 널리 쓰이는 안정적인 엔드포인트 — 스펙이 바뀌면 파싱이 깨질 수 있음)
export async function getGoogleTrendsKR(): Promise<TrendItem[]> {
  const res = await fetch('https://trends.google.com/trending/rss?geo=KR', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`구글 트렌드 조회 실패 (${res.status})`);
  const xml = await res.text();

  const items: TrendItem[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
    const trafficMatch = block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/);
    if (titleMatch) {
      items.push({ title: titleMatch[1].trim(), trafficLabel: trafficMatch ? trafficMatch[1].trim() : null });
    }
  }
  return items;
}
