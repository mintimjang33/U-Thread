import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { issueExtensionToken } from '../../../../lib/extensionAuth';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const token = issueExtensionToken(user.id);
  return NextResponse.json({ token });
}
