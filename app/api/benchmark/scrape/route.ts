import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i');
  const match = html.match(re) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'));
  return match ? match[1] : null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const url = body?.url?.trim();
  if (!url || !/^https:\/\/(www\.)?threads\.(net|com)\//.test(url)) {
    return NextResponse.json({ error: 'threads.net 또는 threads.com 글 링크를 입력해주세요.' }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
    });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: '링크를 가져오지 못했어요. 링크가 올바른지 확인해주세요.' }, { status: 502 });
  }

  const description = extractMeta(html, 'og:description');
  const title = extractMeta(html, 'og:title');
  const image = extractMeta(html, 'og:image');

  if (!description && !title) {
    return NextResponse.json(
      { error: '이 링크에서 내용을 자동으로 읽어오지 못했어요. "수동 등록"으로 직접 붙여넣어주세요.' },
      { status: 422 }
    );
  }

  const content = description || title || '';
  const source = title && title !== description ? title : url;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_benchmark_items')
    .insert({
      user_id: user.id,
      source,
      content,
      media_url: image || null,
      folder_id: body.folder_id || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}
