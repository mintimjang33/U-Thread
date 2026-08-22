import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { publishScheduledPost } from '../../../../lib/publishThreadPost';

// Vercel Cron이 주기적으로 호출한다(vercel.json 설정). CRON_SECRET이 설정되어 있으면
// Vercel이 Authorization: Bearer <CRON_SECRET> 헤더를 자동으로 붙여서 호출한다.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: due } = await supabase
    .from('ut_thread_posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString());

  const results = [];
  for (const row of due || []) {
    try {
      await publishScheduledPost(row.id);
      results.push({ id: row.id, ok: true });
    } catch (err) {
      results.push({ id: row.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
