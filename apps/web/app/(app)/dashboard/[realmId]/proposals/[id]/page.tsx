'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from 'lucide-react';
import { cn, formatNumber } from '@shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { VotePanel } from '@/components/governance/VotePanel';
import type { Proposal } from '@shared/types/governance';

interface ProposalDetailResponse {
  proposal: {
    address: string;
    governance: string;
    governingTokenMint: string;
    tokenOwnerRecord: string;
    title: string;
    descriptionLink: string;
    status: string;
    forVotes: number;
    againstVotes: number;
    abstainVotes: number;
    draftAt: string;
    startVotingAt: string;
    votingCompletedAt: string;
  };
  votes: Array<{
    address: string;
    proposal: string;
    governingTokenOwner: string;
    isRelinquished: boolean;
    voterWeight: number;
    vote: unknown;
  }>;
  totalVotes: number;
  autonomousVotes: Array<{
    id: string;
    agentId: string;
    agentName: string;
    vote: string;
    reasoning: string;
    confidence: number;
    txSignature: string | null;
    tapestryContentId: string | null;
    createdAt: number;
  }>;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'voting':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'succeeded':
      return 'bg-green-500/15 text-green-400 border-green-500/30';
    case 'defeated':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'draft':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    case 'executing':
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ProposalSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ProposalDetailPage({
  params,
}: {
  params: Promise<{ realmId: string; id: string }>;
}) {
  const { realmId, id } = React.use(params);

  const [proposalData, setProposalData] = useState<ProposalDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProposal() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/governance/proposals/${id}`);
        if (!res.ok) throw new Error(`Failed to fetch proposal: ${res.statusText}`);
        const data: ProposalDetailResponse = await res.json();
        setProposalData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load proposal');
      } finally {
        setIsLoading(false);
      }
    }
    fetchProposal();
  }, [id]);

  if (isLoading) return <ProposalSkeleton />;

  if (error || !proposalData) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/50 bg-destructive/5 py-20">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h3 className="mt-4 text-base font-semibold text-foreground">Failed to load proposal</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error || 'Proposal not found'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const proposal = proposalData.proposal;

  // Prefer STDB agent votes over on-chain counts (on-chain may be 0 when txs fail)
  const agentFor = proposalData.autonomousVotes.filter((v) => v.vote === 'for').length;
  const agentAgainst = proposalData.autonomousVotes.filter((v) => v.vote === 'against').length;
  const agentAbstain = proposalData.autonomousVotes.filter((v) => v.vote === 'abstain').length;
  const hasAgentVotes = proposalData.autonomousVotes.length > 0;

  const displayFor = hasAgentVotes ? agentFor : proposal.forVotes;
  const displayAgainst = hasAgentVotes ? agentAgainst : proposal.againstVotes;
  const displayAbstain = hasAgentVotes ? agentAbstain : (proposal.abstainVotes ?? 0);
  const totalVotes = displayFor + displayAgainst + displayAbstain;
  const forPercent = totalVotes > 0 ? (displayFor / totalVotes) * 100 : 0;
  const againstPercent = totalVotes > 0 ? (displayAgainst / totalVotes) * 100 : 0;
  const abstainPercent = totalVotes > 0 ? (displayAbstain / totalVotes) * 100 : 0;

  const proposalForPanel: Proposal = {
    address: proposal.address,
    realmAddress: realmId,
    title: proposal.title,
    description: proposal.descriptionLink || '',
    status: proposal.status as Proposal['status'],
    forVotes: displayFor,
    againstVotes: displayAgainst,
    abstainVotes: displayAbstain,
    deadline: proposal.votingCompletedAt
      ? new Date(proposal.votingCompletedAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: proposal.draftAt ? new Date(proposal.draftAt) : new Date(),
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/${realmId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to realm
      </Link>

      <div>
        <div className="flex items-start gap-3">
          <h1 className="text-2xl font-bold text-foreground">{proposal.title}</h1>
          <Badge className={cn('mt-1 shrink-0 text-xs font-medium capitalize', statusBadgeClass(proposal.status))} variant="outline">
            {proposal.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {proposal.descriptionLink ? (
                <div className="space-y-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {proposal.descriptionLink}
                  </p>
                  {proposal.descriptionLink.startsWith('http') && (
                    <a
                      href={proposal.descriptionLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      View full description
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided for this proposal.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vote Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <ThumbsUp className="h-4 w-4 text-green-400" />
                    For
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(displayFor)}{' '}
                    <span className="text-xs text-muted-foreground">({forPercent.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${forPercent}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <ThumbsDown className="h-4 w-4 text-red-400" />
                    Against
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(displayAgainst)}{' '}
                    <span className="text-xs text-muted-foreground">({againstPercent.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${againstPercent}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <Minus className="h-4 w-4 text-zinc-400" />
                    Abstain
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(displayAbstain)}{' '}
                    <span className="text-xs text-muted-foreground">({abstainPercent.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-zinc-500 transition-all duration-500" style={{ width: `${abstainPercent}%` }} />
                </div>
              </div>

              {totalVotes > 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  {formatNumber(totalVotes)} total votes
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6 pl-6 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border">
                <TimelineItem label="Draft Created" date={formatDate(proposal.draftAt)} active={!!proposal.draftAt} />
                <TimelineItem label="Voting Started" date={formatDate(proposal.startVotingAt)} active={!!proposal.startVotingAt} />
                <TimelineItem label="Voting Completed" date={formatDate(proposal.votingCompletedAt)} active={!!proposal.votingCompletedAt} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <VotePanel proposal={proposalForPanel} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Autonomous Agent Decisions</CardTitle>
            </CardHeader>
            <CardContent>
              {proposalData.autonomousVotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No autonomous votes recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {proposalData.autonomousVotes.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.agentName}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(new Date(item.createdAt * 1000).toISOString())}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {item.vote}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Confidence: {(item.confidence * 100).toFixed(1)}%
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-4">{item.reasoning}</p>
                      {item.txSignature && (
                        <a
                          href={`https://explorer.solana.com/tx/${item.txSignature}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {item.txSignature.slice(0, 8)}...{item.txSignature.slice(-8)}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  date,
  active,
}: {
  label: string;
  date: string;
  active: boolean;
}) {
  return (
    <div className="relative">
      <div
        className={cn(
          'absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2',
          active ? 'border-primary bg-primary/20' : 'border-border bg-background',
        )}
      />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {date}
        </p>
      </div>
    </div>
  );
}
