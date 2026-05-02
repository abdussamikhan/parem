/**
 * middleware.ts
 *
 * Next.js Edge Middleware — runs before every matched request.
 *
 * Logic:
 *  1. Public routes (/login, /api/auth/*, assets) → pass through
 *  2. No session cookie → redirect /login
 *  3. Invalid / expired JWT → clear cookie + redirect /login
 *  4. Role not permitted for this path → redirect /  (hub)
 *  5. Everything else → allow
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE, ROLE_ROUTES, type UserRole } from '@/app/lib/auth';

// ─── Public paths (no auth required) ─────────────────────────────────────────

const PUBLIC_PREFIXES = ['/login', '/api/auth', '/api'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

// ─── Role permission check ────────────────────────────────────────────────────

function isRoleAllowed(role: UserRole, pathname: string): boolean {
  if (pathname === '/') return true;
  return (ROLE_ROUTES[role] ?? []).some((prefix) => pathname.startsWith(prefix));
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Always allow public routes
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  // 2. No cookie → redirect to login
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Verify JWT
  let payload: { role: UserRole } | null = null;
  try {
    const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload: p } = await jwtVerify(token, jwtSecret);
    payload = p as unknown as { role: UserRole };
  } catch {
    // Invalid or expired token → clear cookie + redirect
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // 4. Role-based route guard
  if (!isRoleAllowed(payload.role, pathname)) {
    // Redirect to hub — user is authenticated but lacks permission for this page
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 5. Attach role + pathname to headers so Server Components can read without re-verifying
  const res = NextResponse.next();
  res.headers.set('x-user-role', payload.role);
  res.headers.set('x-pathname', pathname);
  return res;
}

// ─── Matcher: run on all non-asset routes ────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
