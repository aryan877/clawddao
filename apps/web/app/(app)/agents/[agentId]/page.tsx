'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Minus,
  TrendingUp,
  Users,
  Vote,
  Shield,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTable, useSpacetimeDB } from 'spacetimedb/react';
import { tables } from '@/module_bindings';

const GRADIENT_PALETTE = [
  'from-emerald-500 to-cyan-500',
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-indigo-500',
  'from-lime-500 to-emerald-500',
];

function pickGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PALETTE[Math.abs(hash) % GRADIENT_PALETTE.length];
}

const VOTE_BADGE: Record<string, string> = {
  for: 'bg-green-500/15 text-green-400 border-green-500/30',
  against: 'bg-red-500/15 text-red-400 border-red-500/30',
  abstain: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

const VOTE_ICON: Record<string, React.ElementType> = {
  for: ThumbsUp,
  against: ThumbsDown,
  abstain: Minus,
};

function formatDate(ts: Date): string {
  return ts.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AgentSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-24" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = React.use(params);

  const [agentRows, isAgentsReady] = useTable(tables.agents);
  const [voteRows] = useTable(tables.votes);
  const [delegationRows] = useTable(tables.delegations);
  const { connectionError } = useSpacetimeDB();

  const agent = useMemo(
    () => agentRows.find((a) => a.id.toString() === agentId) ?? null,
    [agentRows, agentId],
  );

  const agentVotes = useMemo(
    () =>
      voteRows
        .filter((v) => v.agentId.toString() === agentId)
        .sort((a, b) => {
          const ta = a.createdAt?.toDate?.() ?? new Date(0);
          const tb = b.createdAt?.toDate?.() ?? new Date(0);
          return tb.getTime() - ta.getTime();
        }),
    [voteRows, agentId],
  );

  const agentDelegations = useMemo(
    () => delegationRows.filter((d) => d.agentId.toString() === agentId && d.isActive),
    [delegationRows, agentId],
  );

  if (!isAgentsReady && !connectionError) {
    return <AgentSkeleton />;
  }

  if (!agent) {
    return (
      <div className="space-y-6">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to agents
        </Link>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20">
          <Bot className="h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-4 text-base font-semibold text-foreground">Agent not found</h3>
          <p className="mt-1 text-sm text-muted-foreground">This agent doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const gradient = pickGradient(agentId);
  const forCount = agentVotes.filter((v) => v.vote === 'for').length;
  const againstCount = agentVotes.filter((v) => v.vote === 'against').length;
  const abstainCount = agentVotes.filter((v) => v.vote === 'abstain').length;
  const onChainCount = agentVotes.filter((v) => v.txSignature).length;

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(agent.configJson || '{}');
  } catch { /* ignore */ }

  const solanaNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to agents
      </Link>

      {/* Agent Header */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xl font-bold text-white',
            gradient,
          )}
        >
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                agent.isActive
                  ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
              )}
            >
              {agent.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner: {agent.ownerWallet.slice(0, 6)}...{agent.ownerWallet.slice(-4)}
          </p>
          {agent.privyWalletAddress && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Wallet: {agent.privyWalletAddress.slice(0, 6)}...{agent.privyWalletAddress.slice(-4)}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Values Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-primary" />
                Values Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {agent.valuesProfile}
              </p>
              {Array.isArray(config.focusAreas) && config.focusAreas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(config.focusAreas as string[]).map((area) => (
                    <Badge key={area} variant="secondary" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Voting History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Vote className="h-4 w-4 text-primary" />
                Voting History
                {agentVotes.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({agentVotes.length} votes)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agentVotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No votes recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {agentVotes.map((v) => {
                    const VoteIcon = VOTE_ICON[v.vote] ?? Minus;
                    const ts = v.createdAt?.toDate?.() ?? new Date();
                    return (
                      <div
                        key={Number(v.id)}
                        className="rounded-lg border border-border bg-secondary/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-muted-foreground">
                              {v.proposalAddress.slice(0, 8)}...{v.proposalAddress.slice(-8)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                              {formatDate(ts)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('shrink-0 capitalize text-xs', VOTE_BADGE[v.vote])}
                          >
                            <VoteIcon className="mr-1 h-3 w-3" />
                            {v.vote}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Confidence: {(v.confidence * 100).toFixed(1)}%
                        </p>
                        {v.reasoning && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                            {v.reasoning}
                          </p>
                        )}
                        {v.txSignature && (
                          <a
                            href={`https://explorer.solana.com/tx/${v.txSignature}?cluster=${solanaNetwork}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {v.txSignature.slice(0, 8)}...{v.txSignature.slice(-8)}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatRow icon={Vote} label="Total Votes" value={agent.totalVotes.toString()} />
              <StatRow
                icon={TrendingUp}
                label="Accuracy"
                value={`${agent.accuracyScore}%`}
                valueColor={
                  agent.accuracyScore >= 80
                    ? 'text-green-400'
                    : agent.accuracyScore >= 50
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }
              />
              <StatRow icon={Users} label="Delegators" value={agentDelegations.length.toString()} />
              <StatRow
                icon={Shield}
                label="Risk Tolerance"
                value={agent.riskTolerance}
                className="capitalize"
              />
            </CardContent>
          </Card>

          {/* Vote Breakdown */}
          {agentVotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vote Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <BreakdownRow label="For" count={forCount} total={agentVotes.length} color="bg-green-500" />
                <BreakdownRow label="Against" count={againstCount} total={agentVotes.length} color="bg-red-500" />
                <BreakdownRow label="Abstain" count={abstainCount} total={agentVotes.length} color="bg-yellow-500" />
                {onChainCount > 0 && (
                  <p className="pt-2 text-xs text-primary/70">
                    {onChainCount} vote{onChainCount !== 1 ? 's' : ''} confirmed on-chain
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto Vote</span>
                <span className="font-medium text-foreground">
                  {config.autoVote ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confidence Threshold</span>
                <span className="font-medium text-foreground">
                  {typeof config.confidenceThreshold === 'number'
                    ? `${(config.confidenceThreshold * 100).toFixed(0)}%`
                    : '65%'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium text-foreground">
                  {formatDate(agent.createdAt.toDate())}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  valueColor,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueColor?: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className={cn('text-sm font-semibold text-foreground', valueColor, className)}>
        {value}
      </span>
    </div>
  );
}

function BreakdownRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {count} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
