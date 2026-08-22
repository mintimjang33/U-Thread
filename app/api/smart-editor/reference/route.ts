import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { fetchUrlReference, fetchYoutubeReference } from '../../../../lib/urlReference';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const url = body?.url?.trim() as string | undefined;
  const youtubeUrl = body?.youtubeUrl?.trim() as string | undefined;
  if (!url && !youtubeUrl) return NextResponse.json({ error: 'url 또는 youtubeUrl이 필요합니다.' }, { status: 400 });

  try {
    const parts: string[] = [];
    if (url) parts.push(await fetchUrlReference(url));
    if (youtubeUrl) parts.push(await fetchYoutubeReference(youtubeUrl));
    return NextResponse.json({ reference: parts.join('\n\n') });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
