'use client';

import Link from 'next/link';
import { Clock, ChevronRight } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { FeedItem } from '@/lib/feed-types';

type ProposalFeedItem = Extract<FeedItem, { kind: 'proposal' }>;

interface ActiveProposalsBarProps {
  proposals: ProposalFeedItem[];
}

const STATUS_DOT: Record<string, string> = {
  voting: 'bg-blue-400',
  succeeded: 'bg-green-400',
  defeated: 'bg-red-400',
  draft: 'bg-zinc-400',
  executing: 'bg-yellow-400',
  completed: 'bg-primary',
};

function timeRemaining(deadline: Date): string | null {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

export function ActiveProposalsBar({ proposals }: ActiveProposalsBarProps) {
  if (proposals.length === 0) return null;

  // Show active (voting) proposals first, then recent ones
  const active = proposals.filter((p) => p.proposal.status === 'voting');
  const display = active.length > 0 ? active : proposals.slice(0, 5);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Active Proposals
        </h3>
        <Badge variant="outline" className="text-[10px] font-medium">
          {active.length} voting
        </Badge>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {display.map((item) => {
          const remaining =
            item.proposal.status === 'voting'
              ? timeRemaining(item.proposal.deadline)
              : null;
          const dot = STATUS_DOT[item.proposal.status] ?? STATUS_DOT.draft;

          return (
            <Link
              key={item.proposal.address}
              href={`/dashboard/${item.realmAddress}/proposals/${item.proposal.address}`}
              className="group flex min-w-[220px] max-w-[280px] shrink-0 items-start gap-2.5 rounded-lg border border-border bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-card"
            >
              <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                  {item.proposal.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{item.realmName}</span>
                  {remaining && (
                    <>
                      <span>&middot;</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {remaining}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
