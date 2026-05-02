/**
 * app/(app)/admin/page.tsx
 * Admin Data Manager — ADMIN role only.
 * Server component: checks session, then delegates to client panel.
 */
import { getSession } from '@/app/lib/auth';
import { redirect } from 'next/navigation';
import { AdminPanel } from './AdminPanel';

export const metadata = {
  title: 'Admin Data Manager · Parem',
};

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/');
  return <AdminPanel />;
}
