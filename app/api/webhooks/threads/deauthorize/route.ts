import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../../lib/supabase';
import { parseSignedRequest } from '../../../../../lib/metaSignedRequest';

// Meta가 사용자의 앱 연결 해제(제거) 시 호출하는 콜백. signed_request의 user_id는 Threads 앱-스코프 사용자 ID.
export async function POST(request: Request) {
  const appSecret = process.env.THREADS_APP_SECRET;
  if (!appSecret) return NextResponse.json({ error: 'server_not_configured' }, { status: 500 });

  const form = await request.formData();
  const signedRequest = form.get('signed_request');
  if (typeof signedRequest !== 'string') {
    return NextResponse.json({ error: 'missing signed_request' }, { status: 400 });
  }

  const payload = parseSignedRequest(signedRequest, appSecret);
  if (!payload?.user_id) {
    return NextResponse.json({ error: 'invalid signed_request' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  await supabase.from('ut_threads_accounts').delete().eq('threads_user_id', payload.user_id);

  return NextResponse.json({ success: true });
}
