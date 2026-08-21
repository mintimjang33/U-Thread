import { createBrowserClient } from '@supabase/ssr';

// 클라이언트 컴포넌트('use client')에서 로그인/로그아웃 등을 호출할 때 쓰는 브라우저용 클라이언트.
export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
