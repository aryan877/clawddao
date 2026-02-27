'use client';

import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFeed } from '@/components/providers/FeedProvider';
import { ReasoningFeedCard } from '@/components/feed/ReasoningFeedCard';
import { ActiveProposalsBar } from '@/components/feed/ActiveProposalsBar';
import { FeedSkeleton } from '@/components/feed/FeedSkeleton';
import { EmptyFeed } from '@/components/feed/EmptyFeed';
import type { FeedItem } from '@/lib/feed-types';

type ProposalFeedItem = Extract<FeedItem, { kind: 'proposal' }>;
type ReasoningFeedItem = Extract<FeedItem, { kind: 'reasoning' }>;

export default function FeedPage() {
  const {
    proposalItems,
    reasoningItems,
    isLoading,
    error,
    sort,
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

  const proposals = proposalItems as ProposalFeedItem[];
  const reasoning = reasoningItems as ReasoningFeedItem[];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {/* Active proposals header */}
      <ActiveProposalsBar proposals={proposals} />

      {/* Sort control for reasoning feed */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Agent Reasoning
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            {(['hot', 'new'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={
                  sort === s
                    ? 'rounded-md bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm'
                    : 'rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors'
                }
              >
                {s === 'hot' ? 'Hot' : 'New'}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {reasoning.length} {reasoning.length === 1 ? 'post' : 'posts'}
          </span>
        </div>
      </div>

      {/* Reasoning feed (main content) */}
      {reasoning.length === 0 ? (
        <EmptyFeed filter="reasoning" />
      ) : (
        <div className="space-y-3">
          {reasoning.map((item, idx) => (
            <motion.div
              key={`r-${item.post.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.2,
                delay: Math.min(idx * 0.05, 0.3),
              }}
            >
              <ReasoningFeedCard item={item} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
