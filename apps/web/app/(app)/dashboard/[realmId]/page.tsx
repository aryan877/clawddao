'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Copy, Check, Users, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProposalList } from '@/components/governance/ProposalList';
import type { Proposal } from '@shared/types/governance';

interface RealmDetailResponse {
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
  raw: RealmDetailResponse['proposals'][number],
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

function RealmSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
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
  );
}

export default function RealmDetailPage({
  params,
}: {
  params: Promise<{ realmId: string }>;
}) {
  const { realmId } = React.use(params);

  const [realm, setRealm] = useState<RealmDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchRealm() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/governance/realms/${realmId}`);
        if (!res.ok) throw new Error(`Failed to fetch realm: ${res.statusText}`);
        const data = await res.json();
        const normalized: RealmDetailResponse = {
          address: data.realm.address,
          name: data.realm.name,
          communityMint: data.realm.communityMint,
          authority: data.realm.authority,
          proposals: data.proposals,
        };
        setRealm(normalized);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load realm');
      } finally {
        setIsLoading(false);
      }
    }
    fetchRealm();
  }, [realmId]);

  const handleCopyAddress = useCallback(() => {
    if (!realm) return;
    navigator.clipboard.writeText(realm.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [realm]);

  if (isLoading) return <RealmSkeleton />;

  if (error || !realm) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/50 bg-destructive/5 py-20">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h3 className="mt-4 text-base font-semibold text-foreground">Failed to load realm</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error || 'Realm not found'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const proposals = realm.proposals.map((p) => mapProposal(p, realm.address));

  const shortAddr = `${realm.address.slice(0, 6)}...${realm.address.slice(-4)}`;
  const shortMint = `${realm.communityMint.slice(0, 6)}...${realm.communityMint.slice(-4)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{realm.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={handleCopyAddress}
            className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {shortAddr}
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          </button>
          <Badge variant="outline" className="gap-1 text-xs">
            <Coins className="h-3 w-3" />
            Mint: {shortMint}
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            {proposals.length} proposals
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="proposals">
        <TabsList>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="treasury">Treasury</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals">
          <ProposalList proposals={proposals} />
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                Community Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Member data is loaded from on-chain token holder accounts.
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Connect your wallet and hold the community token to appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="treasury">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="h-4 w-4 text-primary" />
                Treasury Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Coins className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Treasury balance and transaction history will appear here once the realm&apos;s native treasury accounts are indexed.
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Data sourced from on-chain governance treasury accounts.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
