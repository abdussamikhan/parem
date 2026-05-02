'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  return (
    <button
      id="logout-btn"
      onClick={handleLogout}
      className="logout-btn"
    >
      Sign out
      <style>{`
        .logout-btn {
          display: flex; align-items: center; gap: .375rem;
          padding: .4rem .875rem;
          font-size: .8125rem; font-weight: 600;
          color: rgba(255,255,255,.55);
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 8px;
          cursor: pointer;
          transition: all .2s;
          white-space: nowrap;
        }
        .logout-btn:hover {
          color: #fff;
          background: rgba(239,68,68,.15);
          border-color: rgba(239,68,68,.3);
        }
      `}</style>
    </button>
  );
}
