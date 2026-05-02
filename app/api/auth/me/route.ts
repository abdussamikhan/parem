/**
 * app/api/auth/me/route.ts
 * Returns the current session user info — used by the client-side NavBar.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  return NextResponse.json({
    fullName: session.fullName,
    role:     session.role,
    email:    session.email,
  });
}
