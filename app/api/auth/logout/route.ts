/**
 * app/api/auth/logout/route.ts
 *
 * POST /api/auth/logout
 *
 * Clears the session cookie and returns a redirect response.
 * The client should navigate to /login after calling this.
 */

import { NextResponse } from 'next/server';
import { SESSION_COOKIE, getSession } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function POST() {
  const session = await getSession();
  if (session) {
    await prisma.auditLog.create({
      data: {
        action: 'USER_LOGOUT',
        entityType: 'User',
        entityId: session.userId,
        details: `User ${session.email} logged out`,
        performedBy: session.email,
      }
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    path:     '/',
    maxAge:   0, // immediately expire
  });
  return res;
}
