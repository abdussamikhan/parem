'use client';
/**
 * app/components/NavBar.tsx  — Client Component
 * Uses usePathname() for reliable active-tab detection in Next.js App Router.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogoutButton } from './LogoutButton';
import { ShieldAlert, Activity, Users, LayoutGrid, Database } from 'lucide-react';

const NAV_LINKS = [
  { href: '/triage',   label: 'Emergency Triage',     icon: ShieldAlert, accent: '#ef4444', roles: ['NURSE',  'ADMIN'] },
  { href: '/clinical', label: 'Clinical Intelligence', icon: Activity,    accent: '#6366f1', roles: ['PHYSICIAN', 'ADMIN'] },
  { href: '/family',   label: 'Family \u0026 Comms',   icon: Users,       accent: '#a855f7', roles: ['COORDINATOR', 'ADMIN'] },
  { href: '/admin',    label: 'Admin Data',            icon: Database,    accent: '#10b981', roles: ['ADMIN'] },
] as const;

const ROLE_COLORS: Record<string, string> = {
  ADMIN:       'rgba(99,102,241,.25)',
  PHYSICIAN:   'rgba(99,102,241,.25)',
  NURSE:       'rgba(239,68,68,.25)',
  COORDINATOR: 'rgba(168,85,247,.25)',
};
const ROLE_TEXT: Record<string, string> = {
  ADMIN:       '#a5b4fc',
  PHYSICIAN:   '#a5b4fc',
  NURSE:       '#fca5a5',
  COORDINATOR: '#d8b4fe',
};

type Session = { fullName: string; role: string };

export function NavBar() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Fetch session once on mount — lightweight, cached by browser
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSession(data); })
      .catch(() => {});
  }, []);

  if (!session) {
    // Render skeleton bar while session loads
    return (
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="url(#nav-shield-sk)"/>
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs><linearGradient id="nav-shield-sk" x1="3" y1="2" x2="21" y2="23" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#6366f1"/><stop offset="100%" stopColor="#a855f7"/></linearGradient></defs>
            </svg>
          </div>
          <span className="navbar-brand-name">Parem</span>
        </div>
        <style>{NAV_STYLES}</style>
      </nav>
    );
  }

  const role = session.role;

  return (
    <nav className="navbar">
      {/* Brand */}
      <Link href="/" className="navbar-brand">
        <div className="navbar-logo">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="url(#nav-shield)"/>
            <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="nav-shield" x1="3" y1="2" x2="21" y2="23" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="100%" stopColor="#a855f7"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="navbar-brand-name">Parem</span>
      </Link>

      <div className="navbar-sep" />

      {/* Nav links */}
      <div className="navbar-links">
        {NAV_LINKS.map(({ href, label, icon: Icon, accent, roles }) => {
          const allowed = (roles as readonly string[]).includes(role);
          const active  = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={allowed ? href : '/'}
              className={`navbar-link ${active ? 'navbar-link-active' : ''} ${!allowed ? 'navbar-link-disabled' : ''}`}
              style={{ '--accent': accent } as React.CSSProperties}
              title={allowed ? label : `Not available for ${role}`}
            >
              <Icon size={15} />
              <span>{label}</span>
              {active && <span className="navbar-link-dot" style={{ background: accent }} />}
            </Link>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* User chip */}
      <div className="navbar-user" style={{ background: ROLE_COLORS[role] ?? 'rgba(99,102,241,.2)' }}>
        <div className="navbar-avatar" style={{ background: ROLE_TEXT[role] ?? '#a5b4fc', color: '#0a0a14' }}>
          {session.fullName.split(' ').map(w => w[0]).slice(0, 2).join('')}
        </div>
        <div className="navbar-user-info">
          <span className="navbar-user-name">{session.fullName}</span>
          <span className="navbar-user-role" style={{ color: ROLE_TEXT[role] }}>{role}</span>
        </div>
      </div>

      {/* Hub */}
      <Link href="/" className="navbar-hub" title="Role Hub">
        <LayoutGrid size={15} />
      </Link>

      {/* Logout */}
      <LogoutButton />

      <style>{NAV_STYLES}</style>
    </nav>
  );
}

const NAV_STYLES = `
  .navbar{display:flex;align-items:center;gap:.75rem;padding:0 1.5rem;height:58px;background:rgba(10,10,20,.85);border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(16px);position:sticky;top:0;z-index:50}
  .navbar-brand{display:flex;align-items:center;gap:.5rem;text-decoration:none;flex-shrink:0}
  .navbar-logo{width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(99,102,241,.4)}
  .navbar-brand-name{font-size:1.0625rem;font-weight:700;color:#fff;letter-spacing:-.02em}
  .navbar-sep{width:1px;height:24px;background:rgba(255,255,255,.1);flex-shrink:0}
  .navbar-links{display:flex;align-items:center;gap:.25rem}
  .navbar-link{position:relative;display:flex;align-items:center;gap:.4rem;padding:.45rem .875rem;font-size:.8125rem;font-weight:500;color:rgba(255,255,255,.5);text-decoration:none;border-radius:8px;transition:all .2s;white-space:nowrap;border:1px solid transparent}
  .navbar-link:hover:not(.navbar-link-disabled){color:#fff;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.1)}
  .navbar-link-active{color:#fff !important;background:rgba(255,255,255,.08) !important;border-color:rgba(255,255,255,.12) !important}
  .navbar-link-disabled{opacity:.35;cursor:not-allowed}
  .navbar-link-dot{position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);width:16px;height:2px;border-radius:2px}
  .navbar-user{display:flex;align-items:center;gap:.5rem;padding:.35rem .625rem .35rem .35rem;border-radius:10px;flex-shrink:0;border:1px solid rgba(255,255,255,.08)}
  .navbar-avatar{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.6875rem;font-weight:700;flex-shrink:0}
  .navbar-user-info{display:flex;flex-direction:column}
  .navbar-user-name{font-size:.75rem;font-weight:600;color:rgba(255,255,255,.9);line-height:1.2}
  .navbar-user-role{font-size:.625rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;line-height:1.2}
  .navbar-hub{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;color:rgba(255,255,255,.4);border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);transition:all .2s;flex-shrink:0}
  .navbar-hub:hover{color:#fff;background:rgba(255,255,255,.1)}
`;
