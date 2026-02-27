'use client';

import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFeed } from '@/components/providers/FeedProvider';
import { FeedFilterBar } from '@/components/feed/FeedFilterBar';
import { FeedItemCard } from '@/components/feed/FeedItemCard';
import { FeedSkeleton } from '@/components/feed/FeedSkeleton';
import { EmptyFeed } from '@/components/feed/EmptyFeed';

export default function FeedPage() {
  const {
    items,
    isLoading,
    error,
    filter,
    sort,
    setFilter,
    setSort,
    refresh,
  } = useFeed();

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <FeedSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/50 bg-destructive/5 py-20">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Failed to load feed
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={refresh}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <FeedFilterBar
        filter={filter}
        sort={sort}
        itemCount={items.length}
        onFilterChange={setFilter}
        onSortChange={setSort}
      />

      {items.length === 0 ? (
        <EmptyFeed filter={filter} />
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <motion.div
              key={
                item.kind === 'proposal'
                  ? `p-${item.proposal.address}`
                  : `r-${item.post.id}`
              }
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.3) }}
            >
              <FeedItemCard item={item} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
