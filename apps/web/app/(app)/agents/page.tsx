'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentCard } from '@/components/agent/AgentCard';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { Agent } from '@shared/types/governance';

function AgentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authFetch = useAuthFetch();

  useEffect(() => {
    async function fetchAgents() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await authFetch('/api/agents');
        if (!res.ok) {
          // If no agents API exists yet, just show empty state
          if (res.status === 404) {
            setAgents([]);
            return;
          }
          throw new Error(`Failed to fetch agents: ${res.statusText}`);
        }
        const data: Agent[] = await res.json();
        setAgents(data);
      } catch (err) {
        // Gracefully handle missing endpoint
        console.error('Failed to load agents:', err);
        setAgents([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAgents();
  }, []);

  if (isLoading) return <AgentsSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/50 bg-destructive/5 py-20">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h3 className="mt-4 text-base font-semibold text-foreground">
          Failed to load agents
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">AI Agents</h1>
        <Link href="/agents/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      {agents.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
