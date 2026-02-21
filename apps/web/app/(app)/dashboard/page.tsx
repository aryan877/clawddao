'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Activity, FileText, Vote, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DaoCard } from '@/components/governance/DaoCard';
import { ProposalCard } from '@/components/governance/ProposalCard';
import type { Proposal } from '@shared/types/governance';

interface RealmResponse {
  address: string;
  name: string;
  communityMint: string;
  authority: string;
  proposals: Array<{
    address: string;
    governance: string;
    title: string;
    descriptionLink: string;
    status: string;
    forVotes: number;
    againstVotes: number;
    abstainVotes: number;
    draftAt: string;
    startVotingAt: string;
    votingCompletedAt: string;
  }>;
}

function mapProposal(
  raw: RealmResponse['proposals'][number],
  realmAddress: string,
): Proposal {
  return {
    address: raw.address,
    realmAddress,
    title: raw.title,
    description: raw.descriptionLink || '',
    status: raw.status as Proposal['status'],
    forVotes: raw.forVotes,
    againstVotes: raw.againstVotes,
    abstainVotes: raw.abstainVotes,
    deadline: raw.votingCompletedAt
      ? new Date(raw.votingCompletedAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: raw.draftAt ? new Date(raw.draftAt) : new Date(),
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [realms, setRealms] = useState<RealmResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRealms() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/governance/realms');
        if (!res.ok) throw new Error(`Failed to fetch realms: ${res.statusText}`);
        const data: RealmResponse[] = await res.json();
        setRealms(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load governance data');
      } finally {
        setIsLoading(false);
      }
    }
    fetchRealms();
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/50 bg-destructive/5 py-20">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h3 className="mt-4 text-base font-semibold text-foreground">Failed to load dashboard</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const allProposals = realms.flatMap((r) => r.proposals.map((p) => mapProposal(p, r.address)));
  const activeProposals = allProposals.filter((p) => p.status === 'voting');
  const totalProposals = allProposals.length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Activity} label="DAOs Loaded" value={realms.length} />
        <StatCard icon={FileText} label="Total Proposals" value={totalProposals} />
        <StatCard icon={Vote} label="Active Proposals" value={activeProposals.length} />
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Your DAOs</h2>
        {realms.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {realms.map((realm) => (
              <DaoCard
                key={realm.address}
                realm={{
                  address: realm.address,
                  name: realm.name,
                  communityMint: realm.communityMint,
                  proposalCount: realm.proposals.length,
                  memberCount: 0,
                }}
                proposalCount={realm.proposals.length}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
            <Activity className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-sm font-medium text-foreground">No DAOs found</h3>
            <p className="mt-1 text-xs text-muted-foreground">Connect your wallet to see the DAOs you participate in.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Active Proposals</h2>
        {activeProposals.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProposals.map((proposal) => (
              <Link
                key={proposal.address}
                href={`/dashboard/${proposal.realmAddress}/proposals/${proposal.address}`}
                className="block"
              >
                <ProposalCard proposal={proposal} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
            <Vote className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-sm font-medium text-foreground">No active proposals</h3>
            <p className="mt-1 text-xs text-muted-foreground">There are no proposals currently in the voting phase.</p>
          </div>
        )}
      </section>
    </div>
  );
}
