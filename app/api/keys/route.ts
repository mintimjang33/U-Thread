import { NextResponse } from 'next/server';
import { encryptVaultValue } from '../../../lib/vaultCrypto';

// TODO: Supabase 연결 후 api_keys_vault(user_id, provider, encrypted_values) 테이블로 교체.
// 지금은 암호화 자체는 실제로 검증하되(콘솔에 암호문 길이만 로그), 저장은 메모리에만 한다.
const memoryStore = new Map<string, Record<string, string>>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') || 'GEMINI';
  return NextResponse.json({ hasKey: memoryStore.has(provider), provider });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.provider || !body?.values) {
    return NextResponse.json({ error: 'provider/values가 필요합니다.' }, { status: 400 });
  }

  const encrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.values as Record<string, string>)) {
    if (typeof v === 'string' && v) encrypted[k] = encryptVaultValue(v);
  }
  memoryStore.set(body.provider, encrypted);

  return NextResponse.json({ ok: true });
}
