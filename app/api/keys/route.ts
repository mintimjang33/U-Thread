import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/supabaseServerAuth';
import { getWorkerUserId } from '../../../lib/workerAuth';
import { encryptVaultValue } from '../../../lib/vaultCrypto';

export async function GET(request: Request) {
  const workerUserId = await getWorkerUserId(request);
  const user = workerUserId ? null : await getCurrentUser();
  const userId = workerUserId || user?.id;
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') || 'GEMINI';

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('ut_api_keys_vault')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  return NextResponse.json({ hasKey: !!data, provider });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.provider || !body?.values) {
    return NextResponse.json({ error: 'provider/values가 필요합니다.' }, { status: 400 });
  }

  const encrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.values as Record<string, string>)) {
    if (typeof v === 'string' && v) encrypted[k] = encryptVaultValue(v);
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('ut_api_keys_vault')
    .upsert({ user_id: user.id, provider: body.provider, encrypted_values: encrypted }, { onConflict: 'user_id,provider' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
