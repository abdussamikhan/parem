/**
 * app/api/auth/login/route.ts
 *
 * POST /api/auth/login
 * Body: { email: string; password: string }
 *
 * - Looks up user in DB
 * - Verifies bcrypt password
 * - Signs a JWT and sets an HttpOnly session cookie
 * - Returns { role } so the client can redirect to the correct page
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/prisma';
import { signToken, SESSION_COOKIE, type SessionPayload } from '@/app/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email    = (body?.email    ?? '').toLowerCase().trim();
    const password = (body?.password ?? '');

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    // ── Look up user ────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Constant-time to prevent user enumeration
      await bcrypt.compare(password, '$2b$12$invalidhashpadding00000000000000000000000000000');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // ── Verify password ─────────────────────────────────────────────────────
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // ── Sign JWT ────────────────────────────────────────────────────────────
    const payload: SessionPayload = {
      userId:   user.id,
      email:    user.email,
      fullName: user.fullName,
      role:     user.role,
    };
    const token = await signToken(payload);

    // ── Set HttpOnly cookie ─────────────────────────────────────────────────
    const res = NextResponse.json({
      ok:       true,
      role:     user.role,
      fullName: user.fullName,
    });

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      path:     '/',
      maxAge:   60 * 60 * 8, // 8 hours
      // secure: true  ← uncomment when behind HTTPS in production
    });

    return res;
  } catch (err) {
    console.error('[auth/login]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
