import { getSupabaseServerClient } from './supabase';

// 로컬 워커(사용자 PC 프로그램)는 로그인 세션 쿠키가 없으므로, 페어링 토큰(Bearer)으로 사용자를 식별한다.
export async function getWorkerUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return null;

  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from('ut_worker_pairing').select('user_id, expires_at').eq('token', token).maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null; // 이용권 만료

  await supabase.from('ut_worker_pairing').update({ last_seen_at: new Date().toISOString() }).eq('token', token);
  return data.user_id;
}
