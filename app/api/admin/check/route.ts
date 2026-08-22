import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/supabaseServerAuth';
import { isAdminUser } from '../../../../lib/subscription';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ isAdmin: !!user && isAdminUser(user.id) });
}
