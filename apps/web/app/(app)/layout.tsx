'use client';

import { TopNavbar } from '@/components/layout/TopNavbar';
import { RealmSidebar } from '@/components/layout/RealmSidebar';
import { StatsPanel } from '@/components/layout/StatsPanel';
import { FeedProvider } from '@/components/providers/FeedProvider';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeedProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <TopNavbar />

        <div className="flex flex-1 overflow-hidden">
          <RealmSidebar />

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>

          <StatsPanel />
        </div>
      </div>
    </FeedProvider>
  );
}
