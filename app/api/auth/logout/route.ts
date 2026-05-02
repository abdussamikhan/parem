/**
 * app/api/auth/logout/route.ts
 *
 * POST /api/auth/logout
 *
 * Clears the session cookie and returns a redirect response.
 * The client should navigate to /login after calling this.
 */

import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/app/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    path:     '/',
    maxAge:   0, // immediately expire
  });
  return res;
}
