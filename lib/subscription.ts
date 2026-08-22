import { getSupabaseServerClient } from './supabase';

// 서비스 운영자(MCP_OWNER_USER_ID) 계정은 실제 구독 여부와 무관하게 프리미엄이 항상 열려있다.
export async function getIsSubscribed(userId: string): Promise<{ isSubscribed: boolean; expiresAt: string | null }> {
  if (process.env.MCP_OWNER_USER_ID && userId === process.env.MCP_OWNER_USER_ID) {
    return { isSubscribed: true, expiresAt: null };
  }

  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from('ut_subscriptions').select('*').eq('user_id', userId).maybeSingle();
  const isSubscribed = !!data?.is_subscribed && (!data.expires_at || new Date(data.expires_at) > new Date());
  return { isSubscribed, expiresAt: data?.expires_at || null };
}
