'use client';

import { cn, shortAddress } from '@shared/lib/utils';
import { useFeed } from '@/components/providers/FeedProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutGrid } from 'lucide-react';

export function RealmSidebar() {
  const { realms, isLoading, activeRealm, setActiveRealm } = useFeed();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar lg:block">
      <div className="flex h-full flex-col overflow-y-auto">
        {/* Heading */}
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tracked DAOs
          </h2>
        </div>

        {/* Realm list */}
        <nav className="flex-1 space-y-0.5 px-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ))
          ) : (
            <>
              {/* "All" option */}
              <button
                onClick={() => setActiveRealm(null)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
                  activeRealm === null
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">All DAOs</span>
                </div>
              </button>

              {realms.map((realm) => {
                const isActive = activeRealm === realm.address;
                const proposalCount = realm.proposals.length;
                const initials = realm.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <button
                    key={realm.address}
                    onClick={() => setActiveRealm(isActive ? null : realm.address)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        isActive
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {realm.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {shortAddress(realm.address)}
                      </span>
                    </div>
                    {proposalCount > 0 && (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          isActive
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {proposalCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </nav>
      </div>
    </aside>
  );
}
