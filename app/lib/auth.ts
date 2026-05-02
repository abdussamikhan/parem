/**
 * app/lib/auth.ts
 *
 * JWT session helpers using `jose` (edge-compatible).
 * Used by:
 *   - app/api/auth/login/route.ts  (sign token, set cookie)
 *   - middleware.ts                (verify token, enforce role)
 *   - app/(app)/layout.tsx         (read session on server)
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = 'parem_session';
const EXPIRY               = '8h';

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET env var is not set');
  return new TextEncoder().encode(s);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'PHYSICIAN' | 'NURSE' | 'COORDINATOR';

export type SessionPayload = {
  userId:   string;
  email:    string;
  fullName: string;
  role:     UserRole;
};

// ─── Role → allowed routes ────────────────────────────────────────────────────

/** Paths (prefix-matched) each role may access. ADMIN implicitly gets all. */
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  NURSE:       ['/triage'],
  PHYSICIAN:   ['/clinical'],
  COORDINATOR: ['/family'],
  ADMIN:       ['/triage', '/clinical', '/family', '/admin'],
};

/** Returns true if the given role is permitted to access `pathname`. */
export function isRoleAllowed(role: UserRole, pathname: string): boolean {
  if (pathname === '/') return true; // hub is accessible to all authenticated users
  const allowed = ROLE_ROUTES[role] ?? [];
  return allowed.some((prefix) => pathname.startsWith(prefix));
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Server-side session reader ───────────────────────────────────────────────

/** Call inside Server Components / Route Handlers to get current session. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
