'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-lg border border-border bg-card p-4"
        >
          {/* Vote indicator skeleton */}
          <div className="flex w-14 shrink-0 flex-col items-center gap-1">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-12 w-1.5 rounded-full" />
            <Skeleton className="h-3 w-8" />
          </div>

          {/* Content skeleton */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
