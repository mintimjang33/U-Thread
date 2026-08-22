import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServerClient } from '../../../../../lib/supabase';
import { parseSignedRequest } from '../../../../../lib/metaSignedRequest';

// Meta가 사용자의 데이터 삭제 요청 시 호출하는 콜백.
// 응답 규격: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
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

  const confirmationCode = crypto.randomBytes(8).toString('hex');
  return NextResponse.json({
    url: `https://u-thread.vercel.app/policy#deletion-status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
