import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 서버 컴포넌트/라우트 핸들러에서 "현재 로그인한 사용자"를 쿠키 기반으로 읽는 전용 클라이언트.
// publishable(anon) 키를 쓰고 RLS가 적용된다 — 관리자 작업은 lib/supabase.ts를 쓸 것.
export async function getSupabaseServerAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component에서 호출되면 쓰기가 안 되는데, middleware.ts가 세션 갱신을 대신 해주므로 무시해도 된다.
          }
        },
      },
    }
  );
}

export async function getCurrentUser() {
  const supabase = await getSupabaseServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
