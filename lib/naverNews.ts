export type NewsItem = { title: string; link: string; description: string; pubDate: string };

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export async function searchNaverNews(clientId: string, clientSecret: string, query: string, display = 10): Promise<NewsItem[]> {
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
  const res = await fetch(url, {
    headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
  });
  if (!res.ok) throw new Error(`네이버 뉴스 검색 실패 (${res.status})`);
  const json = await res.json();
  return (json.items || []).map((i: { title: string; link: string; description: string; pubDate: string }) => ({
    title: stripHtml(i.title),
    link: i.link,
    description: stripHtml(i.description),
    pubDate: i.pubDate,
  }));
}
