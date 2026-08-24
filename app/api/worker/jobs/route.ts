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

// 웹앱이 새 작업을 큐에 넣는다 (사람 로그인 세션 기준).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.type) return NextResponse.json({ error: 'type이 필요합니다.' }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ut_worker_jobs')
    .insert({ user_id: user.id, type: body.type, input: body.input || {} })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ job: data });
}
