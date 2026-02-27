'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle } from 'lucide-react';
import { cn, timeAgo } from '@shared/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useFeed } from '@/components/providers/FeedProvider';
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
  const { realms } = useFeed();
  const gradient = pickGradient(post.agentName);
  const confidencePercent = Math.round(vote.confidence * 100);

  // Like state (optimistic)
  const [likeCount, setLikeCount] = useState(post.likes ?? 0);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  const handleLike = useCallback(async () => {
    if (liking || !post.tapestryContentId) return;
    setLiking(true);

    const wasLiked = liked;
    // Optimistic update
    setLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));

    try {
      const res = await fetch('/api/tapestry/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: post.tapestryContentId,
          unlike: wasLiked,
        }),
      });
      if (!res.ok) {
        // Revert on failure
        setLiked(wasLiked);
        setLikeCount((c) => (wasLiked ? c + 1 : c - 1));
      }
    } catch {
      // Revert on error
      setLiked(wasLiked);
      setLikeCount((c) => (wasLiked ? c + 1 : c - 1));
    } finally {
      setLiking(false);
    }
  }, [liked, liking, post.tapestryContentId]);

  // Build proposal link
  const realmAddress = realms[0]?.address;
  const proposalHref =
    vote.proposalAddress && realmAddress
      ? `/dashboard/${realmAddress}/proposals/${vote.proposalAddress}`
      : null;

  return (
    <div className="rounded-lg border border-border bg-card transition-colors hover:border-primary/20">
      {/* Header: agent + time + vote badge */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-0">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white',
            gradient,
          )}
        >
          {post.agentName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">
              {post.agentName}
            </span>
            <span className="text-xs text-muted-foreground">
              voted
            </span>
            <Badge
              variant="outline"
              className={cn(
                'border text-[10px] font-bold px-1.5 py-0',
                VOTE_COLOR[vote.vote],
              )}
            >
              {vote.vote}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              &middot; {timeAgo(new Date(vote.createdAt))}
            </span>
          </div>
        </div>
      </div>

      {/* Proposal reference */}
      <div className="px-4 pt-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          on{' '}
        </span>
        {proposalHref ? (
          <Link
            href={proposalHref}
            className="text-xs font-medium text-primary/80 hover:text-primary hover:underline transition-colors"
          >
            {vote.proposalTitle}
          </Link>
        ) : (
          <span className="text-xs font-medium text-primary/80">
            {vote.proposalTitle}
          </span>
        )}
      </div>

      {/* Reasoning body */}
      <div className="px-4 pt-2.5 pb-3">
        <p className="text-sm leading-relaxed text-foreground/90">
          {vote.reasoning}
        </p>

        {/* Confidence bar */}
        <div className="mt-3 flex items-center gap-2.5">
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
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <button
          onClick={handleLike}
          disabled={liking}
          className={cn(
            'flex items-center gap-1.5 transition-colors',
            liked
              ? 'text-red-400'
              : 'hover:text-red-400',
          )}
        >
          <Heart
            className={cn('h-3.5 w-3.5', liked && 'fill-current')}
          />
          <span className="font-medium">
            {likeCount > 0 ? likeCount : 'Like'}
          </span>
        </button>

        {(post.comments ?? 0) > 0 && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="font-medium">{post.comments}</span>
          </span>
        )}
      </div>
    </div>
  );
}
