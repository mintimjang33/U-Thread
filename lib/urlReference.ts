function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i');
  const match = html.match(re) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'));
  return match ? match[1] : null;
}

// 일반 URL의 og:title/og:description을 참고자료 텍스트로 가져온다.
export async function fetchUrlReference(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; facebookexternalhit/1.1)' } });
  if (!res.ok) throw new Error(`URL을 가져오지 못했어요 (${res.status})`);
  const html = await res.text();
  const title = extractMeta(html, 'og:title');
  const description = extractMeta(html, 'og:description');
  if (!title && !description) throw new Error('이 URL에서 참고할 내용을 찾지 못했어요.');
  return [title, description].filter(Boolean).join('\n');
}

// 유튜브는 자막 API 없이 oEmbed로 제목/채널명만 가져온다(전체 스크립트 추출은 아님).
export async function fetchYoutubeReference(url: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  if (!res.ok) throw new Error('유튜브 영상 정보를 가져오지 못했어요. 링크를 확인해주세요.');
  const json = await res.json();
  return `유튜브 영상 "${json.title}" (${json.author_name} 채널)`;
}
