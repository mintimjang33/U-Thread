import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { verifyExtensionToken } from '../../../../lib/extensionAuth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const userId = token ? verifyExtensionToken(token) : null;
  if (!userId) {
    return NextResponse.json({ error: '유효하지 않은 익스텐션 연동 키입니다.' }, { status: 401, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  if (!body?.content?.trim()) {
    return NextResponse.json({ error: 'content가 필요합니다.' }, { status: 400, headers: CORS_HEADERS });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_benchmark_items')
    .insert({ user_id: userId, source: body.source || '', content: body.content })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });

  return NextResponse.json({ item: data }, { headers: CORS_HEADERS });
}
