/**
 * app/(app)/layout.tsx
 * Authenticated app shell — NavBar + content area.
 * All protected pages render inside this layout.
 */
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { NavBar } from '@/app/components/NavBar';

export const metadata: Metadata = {
  title: 'Parem Care Command Center',
  description: 'AI-powered patient monitoring and automated intervention platform.',
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname   = headerList.get('x-pathname') ?? '';

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'column' }}>
      <NavBar activePath={pathname} />
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}
