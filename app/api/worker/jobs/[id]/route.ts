import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../../lib/supabase';
import { getCurrentUser } from '../../../../../lib/supabaseServerAuth';
import { getWorkerUserId } from '../../../../../lib/workerAuth';

async function resolveUserId(request: Request) {
  const workerUserId = await getWorkerUserId(request);
  if (workerUserId) return workerUserId;
  const user = await getCurrentUser();
  return user?.id || null;
}

// 웹앱이 결과를 폴링해서 확인한다.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('ut_worker_jobs').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 });

  return NextResponse.json({ job: data });
}

// 워커가 진행상태/결과를 보고한다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getWorkerUserId(request);
  if (!userId) return NextResponse.json({ error: '워커 인증이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.status) return NextResponse.json({ error: 'status가 필요합니다.' }, { status: 400 });

  const update: Record<string, unknown> = { status: body.status, updated_at: new Date().toISOString() };
  if ('output' in body) update.output = body.output;
  if ('error' in body) update.error = body.error;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('ut_worker_jobs').update(update).eq('id', id).eq('user_id', userId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // collect_benchmark 작업이 완료되면 워커가 긁어온 원본 글들을 벤치마킹 보관함에 자동 적재한다.
  if (data.type === 'collect_benchmark' && body.status === 'done' && Array.isArray(body.output?.items)) {
    const rows = body.output.items
      .filter((it: { content?: string }) => it?.content?.trim())
      .map((it: { content: string; source?: string }) => ({ user_id: userId, content: it.content, source: it.source || '로컬워커 자동수집' }));
    if (rows.length > 0) await supabase.from('ut_benchmark_items').insert(rows);
  }

  return NextResponse.json({ job: data });
}
