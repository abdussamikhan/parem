/**
 * app/(app)/layout.tsx
 * Authenticated app shell — NavBar + content area.
 */
import type { Metadata } from 'next';
import { NavBar } from '@/app/components/NavBar';

export const metadata: Metadata = {
  title: 'Parem Care Command Center',
  description: 'AI-powered patient monitoring and automated intervention platform.',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}
