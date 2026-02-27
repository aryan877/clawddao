'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentCard } from '@/components/agent/AgentCard';
import { useTable, useSpacetimeDB } from 'spacetimedb/react';
import { tables } from '@/module_bindings';
import type { Agent } from '@shared/types/governance';

function AgentsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [rows, isReady] = useTable(tables.agents);
  const { connectionError } = useSpacetimeDB();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isReady) return;
    // Short timeout — if WebSocket hasn't connected or subscription hasn't
    // resolved, fall through to the empty state rather than blocking the UI.
    const timer = setTimeout(() => setTimedOut(true), 1500);
    return () => clearTimeout(timer);
  }, [isReady]);

  // Show skeleton only briefly while waiting for WS subscription.
  // Bail early if connection errored or timed out.
  if (!isReady && !timedOut && !connectionError) {
    return <AgentsSkeleton />;
  }

  const agents: Agent[] = rows.map((r) => ({
    id: r.id.toString(),
    owner: r.ownerWallet,
    name: r.name,
    valuesProfile: r.valuesProfile,
    configJson: JSON.parse(r.configJson || '{}'),
    isActive: r.isActive,
    totalVotes: r.totalVotes,
    accuracy: r.accuracyScore,
    delegationCount: r.delegationCount,
    createdAt: r.createdAt.toDate(),
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {agents.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20">
          <div className="rounded-full bg-primary/10 p-4">
            <Bot className="h-10 w-10 text-primary" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-foreground">
            Create your first AI agent
          </h3>
          <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
            AI agents analyze proposals, vote on your behalf, and maintain
            transparent track records. Describe your governance values and
            let AI do the rest.
          </p>
          <Link href="/agents/create" className="mt-6">
            <Button className="gap-2" size="lg">
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
