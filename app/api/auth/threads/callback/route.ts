import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../../lib/supabase';
import { getCurrentUser } from '../../../../../lib/supabaseServerAuth';
import { encryptVaultValue } from '../../../../../lib/vaultCrypto';

const REDIRECT_URI = 'https://u-thread.vercel.app/api/auth/threads/callback';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error_description') || searchParams.get('error');
  if (oauthError) {
    return NextResponse.redirect(new URL(`/dashboard/threads-manage?error=${encodeURIComponent(oauthError)}`, request.url));
  }
  if (!code) return NextResponse.redirect(new URL('/dashboard/threads-manage?error=missing_code', request.url));

  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL('/dashboard/threads-manage?error=server_not_configured', request.url));
  }

  try {
    // 1) code -> 단기 액세스 토큰
    const shortRes = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
    const shortJson = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token) {
      throw new Error(shortJson.error_message || JSON.stringify(shortJson));
    }

    // 2) 단기 -> 장기(60일) 액세스 토큰 교환
    const longRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${appSecret}&access_token=${shortJson.access_token}`
    );
    const longJson = await longRes.json();
    const accessToken = longJson.access_token || shortJson.access_token;
    const expiresInSec = longJson.expires_in || 60 * 24 * 60 * 60;

    // 3) 프로필(계정) 정보 조회
    const profileRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`);
    const profile = await profileRes.json();
    if (!profile.id) throw new Error('프로필 조회 실패: ' + JSON.stringify(profile));

    const supabase = getSupabaseServerClient();

    // 무료 회원은 Threads 계정 1개까지만 연동 가능 — 원본의 실제 과금모델 반영.
    const [{ count: accountCount }, { data: existing }, { data: sub }] = await Promise.all([
      supabase.from('ut_threads_accounts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('ut_threads_accounts').select('id').eq('user_id', user.id).eq('threads_user_id', profile.id).maybeSingle(),
      supabase.from('ut_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    const isSubscribed = !!sub?.is_subscribed && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    if (!existing && (accountCount || 0) >= 1 && !isSubscribed) {
      return NextResponse.redirect(new URL('/dashboard/threads-manage?error=' + encodeURIComponent('무료 회원은 1개 계정까지만 연동할 수 있어요. 프리미엄 구독 후 다시 시도해주세요.'), request.url));
    }

    const { error } = await supabase.from('ut_threads_accounts').upsert(
      {
        user_id: user.id,
        threads_user_id: profile.id,
        username: profile.username || null,
        encrypted_access_token: encryptVaultValue(accessToken),
        token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
      },
      { onConflict: 'user_id,threads_user_id' }
    );
    if (error) throw new Error(error.message);

    return NextResponse.redirect(new URL('/dashboard/threads-manage?connected=1', request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/dashboard/threads-manage?error=${encodeURIComponent(message.slice(0, 200))}`, request.url));
  }
}
