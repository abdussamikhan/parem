/**
 * app/(app)/page.tsx
 * Landing Hub — role selector for authenticated users.
 * Each card links to the role's primary page.
 * Grayed out if the user's role doesn't have access.
 */
import { getSession } from '@/app/lib/auth';
import { ROLE_ROUTES } from '@/app/lib/auth';
import Link from 'next/link';
import { ShieldAlert, Activity, Users, ArrowRight, Lock } from 'lucide-react';

const ROLE_CARDS = [
  {
    href:        '/triage',
    label:       'Emergency Triage',
    description: 'Monitor active SOS escalations and high-risk patients in real time.',
    roleLabel:   'Nurse · Admin',
    icon:        ShieldAlert,
    gradient:    'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
    glow:        'rgba(239,68,68,.35)',
    bg:          'rgba(239,68,68,.06)',
    border:      'rgba(239,68,68,.2)',
    roles:       ['NURSE', 'ADMIN'],
  },
  {
    href:        '/clinical',
    label:       'Clinical Intelligence',
    description: 'Risk scores, adherence trends, and the full patient roster.',
    roleLabel:   'Physician · Admin',
    icon:        Activity,
    gradient:    'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
    glow:        'rgba(99,102,241,.35)',
    bg:          'rgba(99,102,241,.06)',
    border:      'rgba(99,102,241,.2)',
    roles:       ['PHYSICIAN', 'ADMIN'],
  },
  {
    href:        '/family',
    label:       'Family & Communications',
    description: 'Send weekly health updates and manage family contact broadcasts.',
    roleLabel:   'Coordinator · Admin',
    icon:        Users,
    gradient:    'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
    glow:        'rgba(168,85,247,.35)',
    bg:          'rgba(168,85,247,.06)',
    border:      'rgba(168,85,247,.2)',
    roles:       ['COORDINATOR', 'ADMIN'],
  },
] as const;

export default async function HubPage() {
  const session = await getSession();
  const role    = session?.role ?? 'NURSE';

  return (
    <div className="hub-root">
      {/* Background */}
      <div className="hub-bg" aria-hidden />

      {/* Header */}
      <header className="hub-header">
        <h1 className="hub-title">Care Command Center</h1>
        <p className="hub-subtitle">
          Welcome back, <strong style={{ color: '#fff' }}>{session?.fullName}</strong>. Select your workspace.
        </p>
      </header>

      {/* Cards grid */}
      <div className="hub-grid">
        {ROLE_CARDS.map(({ href, label, description, roleLabel, icon: Icon, gradient, glow, bg, border, roles }) => {
          const allowed = (roles as readonly string[]).includes(role);
          return (
            <div
              key={href}
              className={`hub-card ${!allowed ? 'hub-card-locked' : ''}`}
              style={{
                '--glow':   glow,
                '--bg':     bg,
                '--border': border,
              } as React.CSSProperties}
            >
              {/* Icon */}
              <div className="hub-card-icon" style={{ background: gradient, boxShadow: `0 8px 24px ${glow}` }}>
                <Icon size={28} color="#fff" />
              </div>

              {/* Content */}
              <div className="hub-card-body">
                <div className="hub-card-role">{roleLabel}</div>
                <h2 className="hub-card-title">{label}</h2>
                <p className="hub-card-desc">{description}</p>
              </div>

              {/* CTA */}
              {allowed ? (
                <Link href={href} className="hub-card-cta" style={{ background: gradient }}>
                  Enter workspace
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <div className="hub-card-locked-msg">
                  <Lock size={13} />
                  Not available for {role}
                </div>
              )}

              {/* Hover glow overlay */}
              {allowed && <div className="hub-card-glow-overlay" aria-hidden />}
            </div>
          );
        })}
      </div>

      <style>{`
        .hub-root {
          min-height: calc(100vh - 58px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .hub-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(99,102,241,.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,.04) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .hub-header {
          text-align: center;
          margin-bottom: 3rem;
          position: relative;
        }
        .hub-title {
          font-size: clamp(1.75rem, 4vw, 2.5rem);
          font-weight: 800;
          color: #fff;
          letter-spacing: -.03em;
          margin-bottom: .5rem;
        }
        .hub-subtitle {
          font-size: 1rem;
          color: rgba(255,255,255,.45);
        }
        .hub-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          width: 100%;
          max-width: 960px;
          position: relative;
        }
        .hub-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 1.75rem;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
          overflow: hidden;
        }
        .hub-card:hover:not(.hub-card-locked) {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px var(--glow);
          border-color: var(--border);
        }
        .hub-card-locked {
          opacity: .45;
          filter: grayscale(.5);
          cursor: default;
        }
        .hub-card-glow-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, var(--glow) 0%, transparent 60%);
          opacity: 0;
          transition: opacity .3s;
          pointer-events: none;
        }
        .hub-card:hover .hub-card-glow-overlay { opacity: 1; }
        .hub-card-icon {
          width: 56px; height: 56px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .hub-card-body { flex: 1; }
        .hub-card-role {
          font-size: .6875rem;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: rgba(255,255,255,.35);
          margin-bottom: .375rem;
        }
        .hub-card-title {
          font-size: 1.1875rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -.02em;
          margin-bottom: .5rem;
        }
        .hub-card-desc {
          font-size: .875rem;
          color: rgba(255,255,255,.5);
          line-height: 1.6;
        }
        .hub-card-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .5rem;
          padding: .7rem 1.25rem;
          font-size: .875rem;
          font-weight: 600;
          color: #fff;
          border-radius: 10px;
          text-decoration: none;
          transition: opacity .2s, transform .15s;
        }
        .hub-card-cta:hover { opacity: .88; transform: translateX(2px); }
        .hub-card-locked-msg {
          display: flex;
          align-items: center;
          gap: .375rem;
          padding: .7rem 1rem;
          font-size: .8125rem;
          font-weight: 500;
          color: rgba(255,255,255,.25);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
