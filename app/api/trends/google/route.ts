import { NextResponse } from 'next/server';
import { getGoogleTrendsKR } from '../../../../lib/googleTrends';

export async function GET() {
  try {
    const items = await getGoogleTrendsKR();
    return NextResponse.json({ items, syncedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
