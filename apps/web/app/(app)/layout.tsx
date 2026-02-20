'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname.startsWith('/dashboard/')) {
    const segments = pathname.split('/');
    if (segments.length >= 4 && segments[3] === 'proposals') {
      return 'Proposal Details';
    }
    return 'Realm Dashboard';
  }
  if (pathname === '/agents') return 'AI Agents';
  if (pathname === '/agents/create') return 'Create Agent';
  if (pathname.startsWith('/agents/')) return 'Agent Details';
  if (pathname === '/social') return 'Social Feed';
  return 'ClawdDAO';
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
