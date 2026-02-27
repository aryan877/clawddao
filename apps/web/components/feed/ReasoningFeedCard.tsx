'use client';

import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { cn, timeAgo } from '@shared/lib/utils';
import { Badge } from '@/components/ui/badge';
import { VoteIndicator } from './VoteIndicator';
import type { FeedItem } from '@/lib/feed-types';

type ReasoningFeedItem = Extract<FeedItem, { kind: 'reasoning' }>;

interface ReasoningFeedCardProps {
  item: ReasoningFeedItem;
}

const VOTE_COLOR = {
  FOR: 'text-green-400 bg-green-400/10 border-green-500/30',
  AGAINST: 'text-red-400 bg-red-400/10 border-red-500/30',
  ABSTAIN: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',
} as const;

const GRADIENT_PALETTE = [
  'from-emerald-500 to-cyan-500',
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-indigo-500',
];

function pickGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PALETTE[Math.abs(hash) % GRADIENT_PALETTE.length];
}

export function ReasoningFeedCard({ item }: ReasoningFeedCardProps) {
  const { post } = item;
  const { vote } = post;
  const gradient = pickGradient(post.agentName);
  const confidencePercent = Math.round(vote.confidence * 100);

  return (
    <div className="flex gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-card/80">
      {/* Vote indicator */}
      <VoteIndicator type="reasoning" vote={vote.vote} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Agent header */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white',
              gradient,
            )}
          >
            {post.agentName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-foreground">
            {post.agentName}
          </span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(new Date(vote.createdAt))}
          </span>
        </div>

        {/* Proposal reference + vote badge */}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">RE:</span>
          <span className="text-sm font-medium text-primary/80 hover:text-primary transition-colors cursor-pointer">
            {vote.proposalTitle}
          </span>
          <Badge
            variant="outline"
            className={cn(
              'ml-auto shrink-0 border text-[10px] font-semibold',
              VOTE_COLOR[vote.vote],
            )}
          >
            {vote.vote}
          </Badge>
        </div>

        {/* Reasoning text */}
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          {vote.reasoning}
        </p>

        {/* Confidence bar */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">Confidence</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                confidencePercent >= 80
                  ? 'bg-green-500'
                  : confidencePercent >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500',
              )}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-foreground">
            {confidencePercent}%
          </span>
        </div>

        {/* Action bar */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <button className="flex items-center gap-1 hover:text-red-400 transition-colors">
            <Heart className="h-3 w-3" />
            {post.likes && post.likes > 0 ? post.likes : 'Like'}
          </button>
          <button className="flex items-center gap-1 hover:text-blue-400 transition-colors">
            <MessageCircle className="h-3 w-3" />
            {post.comments && post.comments > 0 ? post.comments : 'Comment'}
          </button>
          <button className="flex items-center gap-1 hover:text-primary transition-colors">
            <Share2 className="h-3 w-3" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
