'use client';

import type { FeedItem } from '@/lib/feed-types';
import { ProposalFeedCard } from './ProposalFeedCard';
import { ReasoningFeedCard } from './ReasoningFeedCard';

interface FeedItemCardProps {
  item: FeedItem;
}

export function FeedItemCard({ item }: FeedItemCardProps) {
  if (item.kind === 'proposal') {
    return <ProposalFeedCard item={item} />;
  }
  return <ReasoningFeedCard item={item} />;
}
