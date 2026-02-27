'use client';

import { cn } from '@shared/lib/utils';
import { formatNumber } from '@shared/lib/utils';

interface VoteBarProps {
  forVotes: number;
  againstVotes: number;
  abstainVotes?: number;
}

interface VoteBadgeProps {
  vote: 'FOR' | 'AGAINST' | 'ABSTAIN';
}

const BADGE_STYLE = {
  FOR: 'bg-green-500/15 text-green-400 border-green-500/30',
  AGAINST: 'bg-red-500/15 text-red-400 border-red-500/30',
  ABSTAIN: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
} as const;

export function VoteIndicator({
  type,
  ...props
}: (
  | ({ type: 'proposal' } & VoteBarProps)
  | ({ type: 'reasoning' } & VoteBadgeProps)
)) {
  if (type === 'reasoning') {
    const { vote } = props as VoteBadgeProps;
    return (
      <div className="flex w-14 shrink-0 flex-col items-center justify-center">
        <span
          className={cn(
            'rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none',
            BADGE_STYLE[vote],
          )}
        >
          {vote}
        </span>
      </div>
    );
  }

  const { forVotes, againstVotes } = props as VoteBarProps;
  const total = forVotes + againstVotes || 1;
  const forPct = Math.round((forVotes / total) * 100);
  const againstPct = 100 - forPct;

  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1 py-1">
      <span className="text-[10px] font-semibold text-green-400">
        {formatNumber(forVotes)}
      </span>
      <div className="flex h-12 w-1.5 flex-col overflow-hidden rounded-full bg-muted">
        <div
          className="w-full rounded-full bg-green-500 transition-all"
          style={{ height: `${forPct}%` }}
        />
        <div
          className="w-full rounded-full bg-red-500 transition-all"
          style={{ height: `${againstPct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-red-400">
        {formatNumber(againstVotes)}
      </span>
    </div>
  );
}
