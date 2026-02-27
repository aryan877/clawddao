'use client';

import Link from 'next/link';
import { Clock, Bot, Share2 } from 'lucide-react';
import { cn, timeAgo } from '@shared/lib/utils';
import { Badge } from '@/components/ui/badge';
import { VoteIndicator } from './VoteIndicator';
import { useTable } from 'spacetimedb/react';
import { tables } from '@/module_bindings';
import type { FeedItem } from '@/lib/feed-types';

type ProposalFeedItem = Extract<FeedItem, { kind: 'proposal' }>;

interface ProposalFeedCardProps {
  item: ProposalFeedItem;
}

function timeRemaining(deadline: Date): string | null {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.floor(hours / 24);
  return `${days}d remaining`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  voting: { label: 'Voting', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  succeeded: { label: 'Passed', className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  defeated: { label: 'Defeated', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  draft: { label: 'Draft', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  executing: { label: 'Executing', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  completed: { label: 'Completed', className: 'bg-primary/15 text-primary border-primary/30' },
};

export function ProposalFeedCard({ item }: ProposalFeedCardProps) {
  const { proposal, realmName, realmAddress } = item;
  const remaining = proposal.status === 'voting' ? timeRemaining(proposal.deadline) : null;
  const badge = STATUS_BADGE[proposal.status] ?? STATUS_BADGE.draft;

  // Agent votes from SpacetimeDB (real-time via WebSocket)
  const [allVotes] = useTable(tables.votes);
  const proposalVotes = allVotes.filter((v) => v.proposalAddress === proposal.address);
  const agentForVotes = proposalVotes.filter((v) => v.vote === 'for').length;
  const agentAgainstVotes = proposalVotes.filter((v) => v.vote === 'against').length;
  const agentAbstainVotes = proposalVotes.filter((v) => v.vote === 'abstain').length;
  const totalAgentVotes = proposalVotes.length;

  // Use agent votes for display if available, otherwise fall back to on-chain
  const displayFor = totalAgentVotes > 0 ? agentForVotes : proposal.forVotes;
  const displayAgainst = totalAgentVotes > 0 ? agentAgainstVotes : proposal.againstVotes;
  const displayAbstain = totalAgentVotes > 0 ? agentAbstainVotes : (proposal.abstainVotes ?? 0);
  const displayTotal = totalAgentVotes > 0 ? totalAgentVotes : (proposal.forVotes + proposal.againstVotes + (proposal.abstainVotes ?? 0));

  return (
    <Link
      href={`/dashboard/${realmAddress}/proposals/${proposal.address}`}
      className="group block"
    >
      <div className="flex gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-card/80">
        {/* Vote indicator */}
        <VoteIndicator
          type="proposal"
          forVotes={displayFor}
          againstVotes={displayAgainst}
          abstainVotes={displayAbstain}
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Realm + time */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-primary/80">{realmName}</span>
            <span>&middot;</span>
            <span>{timeAgo(item.timestamp)}</span>
          </div>

          {/* Title */}
          <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
            {proposal.title}
          </h3>

          {/* Description snippet */}
          {proposal.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {proposal.description}
            </p>
          )}

          {/* Footer: status + remaining + actions */}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              className={cn('text-[10px] font-semibold border', badge.className)}
            >
              {badge.label}
            </Badge>

            {remaining && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {remaining}
              </span>
            )}

            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {displayTotal.toLocaleString()} vote{displayTotal !== 1 ? 's' : ''}
            </span>

            <button
              onClick={(e) => { e.preventDefault(); }}
              className="ml-auto flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
