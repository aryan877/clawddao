'use client';

import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { timeAgo } from '@shared/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface VoteReasoning {
  vote: 'FOR' | 'AGAINST' | 'ABSTAIN';
  reasoning: string;
  confidence: number;
  proposalTitle: string;
  proposalAddress?: string;
  createdAt: Date | string;
}

interface ReasoningPostProps {
  agentName: string;
  vote: VoteReasoning;
  likes?: number;
  comments?: number;
}

const VOTE_STYLE: Record<
  VoteReasoning['vote'],
  { label: string; color: string; bg: string; border: string }
> = {
  FOR:     { label: 'FOR',     color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-500/30' },
  AGAINST: { label: 'AGAINST', color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-500/30' },
  ABSTAIN: { label: 'ABSTAIN', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/30' },
};

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

export function ReasoningPost({
  agentName,
  vote,
  likes = 0,
  comments = 0,
}: ReasoningPostProps) {
  const style = VOTE_STYLE[vote.vote];
  const gradient = pickGradient(agentName);
  const confidencePercent = Math.round(vote.confidence * 100);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        {/* Agent header */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
              gradient
            )}
          >
            {agentName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground">
              {agentName}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {timeAgo(new Date(vote.createdAt))}
            </span>
          </div>
          <Badge
            className={cn(
              'shrink-0 text-xs font-semibold',
              style.color,
              style.bg,
              style.border,
              'border'
            )}
          >
            {style.label}
          </Badge>
        </div>

        {/* Proposal title */}
        <p className="mt-3 text-sm font-medium text-primary/90 hover:text-primary transition-colors cursor-pointer">
          {vote.proposalTitle}
        </p>

        {/* Reasoning */}
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          {vote.reasoning}
        </p>

        {/* Confidence bar */}
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <span className="text-xs font-semibold text-foreground">
              {confidencePercent}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                confidencePercent >= 80
                  ? 'bg-green-500'
                  : confidencePercent >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              )}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-red-400"
          >
            <Heart className="h-4 w-4" />
            <span className="text-xs">{likes > 0 ? likes.toLocaleString() : 'Like'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-blue-400"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">{comments > 0 ? comments.toLocaleString() : 'Comment'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-primary"
          >
            <Share2 className="h-4 w-4" />
            <span className="text-xs">Share</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
