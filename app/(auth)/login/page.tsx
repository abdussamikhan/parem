/**
 * app/(auth)/login/page.tsx
 * Public login page — no auth required.
 * Premium dark glassmorphism design.
 */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';

function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get('from') ?? '/';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [shake,    setShake]    = useState(false);

  // Subtle animated background dots
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Invalid credentials');
        setShake(true);
        setTimeout(() => setShake(false), 600);
        return;
      }

      // Redirect based on role
      const roleDefaults: Record<string, string> = {
        NURSE:       '/triage',
        PHYSICIAN:   '/clinical',
        COORDINATOR: '/family',
        ADMIN:       '/',
      };

      const dest = from !== '/' ? from : (roleDefaults[json.role] ?? '/');
      router.replace(dest);
    } catch {
      setError('Connection error. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* Animated background grid */}
      <div className="login-bg-grid" aria-hidden />

      {/* Floating orbs */}
      <div className="login-orb login-orb-1" aria-hidden />
      <div className="login-orb login-orb-2" aria-hidden />

      {/* Card */}
      <div className={`login-card ${mounted ? 'login-card-visible' : ''} ${shake ? 'login-card-shake' : ''}`}>

        {/* Logo */}
        <div className="login-logo-row">
          <div className="login-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                    fill="url(#shield-grad)" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="shield-grad" x1="3" y1="2" x2="21" y2="23" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#a855f7"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="login-logo-title">Parem</h1>
            <p className="login-logo-sub">Care Command Center</p>
          </div>
        </div>

        <h2 className="login-heading">Welcome back</h2>
        <p className="login-subheading">Sign in with your hospital credentials</p>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {/* Email */}
          <div className="login-field">
            <label htmlFor="login-email" className="login-label">Email address</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="login-input"
              placeholder="you@parem.sa"
            />
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="login-password" className="login-label">Password</label>
            <div className="login-input-wrap">
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="login-input login-input-pw"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="login-pw-toggle"
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading || !email || !password}
            className="login-btn"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Signing in…</>
            ) : (
              <>Sign in  →</>
            )}
          </button>
        </form>

        <p className="login-footer">
          Secure clinical access · Session expires in 8 hours
        </p>
      </div>

      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a14;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .login-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(99,102,241,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,.06) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          animation: orb-float 8s ease-in-out infinite alternate;
        }
        .login-orb-1 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(99,102,241,.25) 0%, transparent 70%);
          top: -120px; left: -80px;
        }
        .login-orb-2 {
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(168,85,247,.2) 0%, transparent 70%);
          bottom: -80px; right: -60px;
          animation-delay: -4s;
        }
        @keyframes orb-float {
          from { transform: translate(0,0) scale(1);   }
          to   { transform: translate(20px,20px) scale(1.05); }
        }
        .login-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          margin: 1.5rem;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 24px;
          padding: 2.5rem 2rem;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(99,102,241,.15),
            0 32px 64px rgba(0,0,0,.5);
          opacity: 0;
          transform: translateY(24px);
          transition: opacity .4s ease, transform .4s ease;
        }
        .login-card-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
        .login-card-shake {
          animation: shake .5s cubic-bezier(.36,.07,.19,.97) both;
        }
        .login-logo-row {
          display: flex;
          align-items: center;
          gap: .75rem;
          margin-bottom: 1.75rem;
        }
        .login-logo-icon {
          width: 48px; height: 48px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(99,102,241,.4);
          flex-shrink: 0;
        }
        .login-logo-title {
          font-size: 1.375rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -.02em;
          line-height: 1.2;
        }
        .login-logo-sub {
          font-size: .75rem;
          color: rgba(255,255,255,.45);
          margin-top: 1px;
        }
        .login-heading {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -.02em;
          margin-bottom: .375rem;
        }
        .login-subheading {
          font-size: .875rem;
          color: rgba(255,255,255,.45);
          margin-bottom: 2rem;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .login-field {
          display: flex;
          flex-direction: column;
          gap: .4rem;
        }
        .login-label {
          font-size: .75rem;
          font-weight: 600;
          color: rgba(255,255,255,.55);
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .login-input {
          width: 100%;
          padding: .75rem 1rem;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 10px;
          color: #fff;
          font-size: .9375rem;
          outline: none;
          transition: border-color .2s, box-shadow .2s, background .2s;
          box-sizing: border-box;
        }
        .login-input::placeholder { color: rgba(255,255,255,.2); }
        .login-input:focus {
          border-color: rgba(99,102,241,.7);
          box-shadow: 0 0 0 3px rgba(99,102,241,.2);
          background: rgba(255,255,255,.1);
        }
        .login-input-wrap {
          position: relative;
        }
        .login-input-pw {
          padding-right: 2.75rem;
        }
        .login-pw-toggle {
          position: absolute;
          right: .875rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,.3);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          transition: color .2s;
        }
        .login-pw-toggle:hover { color: rgba(255,255,255,.7); }
        .login-error {
          display: flex;
          align-items: center;
          gap: .5rem;
          padding: .625rem .875rem;
          background: rgba(239,68,68,.12);
          border: 1px solid rgba(239,68,68,.3);
          border-radius: 8px;
          color: #fca5a5;
          font-size: .8125rem;
          font-weight: 500;
        }
        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .5rem;
          padding: .8125rem 1.25rem;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #fff;
          font-size: .9375rem;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: opacity .2s, transform .15s, box-shadow .2s;
          box-shadow: 0 8px 24px rgba(99,102,241,.4);
          margin-top: .25rem;
        }
        .login-btn:hover:not(:disabled) {
          opacity: .92;
          transform: translateY(-1px);
          box-shadow: 0 12px 32px rgba(99,102,241,.5);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-btn:disabled {
          opacity: .45;
          cursor: not-allowed;
        }
        .login-footer {
          text-align: center;
          font-size: .75rem;
          color: rgba(255,255,255,.25);
          margin-top: 1.5rem;
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-root">
        <div className="login-card login-card-visible" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Loader2 size={32} className="animate-spin" color="#6366f1" />
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
