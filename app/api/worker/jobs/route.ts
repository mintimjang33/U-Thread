import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { getWorkerUserId } from '../../../../lib/workerAuth';

// 워커가 폴링: 자기 계정의 대기 중인 작업을 가져간다.
export async function GET(request: Request) {
  const userId = await getWorkerUserId(request);
  if (!userId) return NextResponse.json({ error: '워커 인증이 필요합니다 (Authorization: Bearer <페어링 토큰>).' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_worker_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data || [] });
}

// 새 작업을 큐에 넣는다 — 웹앱(사람 로그인 세션) 또는 워커 자신(페어링 토큰, 로컬 대시보드에서 직접 실행할 때) 둘 다 허용.
export async function POST(request: Request) {
  const workerUserId = await getWorkerUserId(request);
  const user = workerUserId ? null : await getCurrentUser();
  const userId = workerUserId || user?.id;
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.type) return NextResponse.json({ error: 'type이 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_worker_jobs')
    .insert({ user_id: userId, type: body.type, input: body.input || {} })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ job: data });
}
