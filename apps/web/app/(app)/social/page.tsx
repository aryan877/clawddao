'use client';

import { useState, useEffect } from 'react';
import { Rss, Wallet, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { GovernanceFeed, type GovernanceFeedPost } from '@/components/social/GovernanceFeed';
import { useWallet } from '@/hooks/useWallet';

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-2 w-full rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function SocialPage() {
  const { authenticated, login } = useWallet();
  const [posts, setPosts] = useState<GovernanceFeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeed() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/tapestry/contents');
        if (!res.ok) {
          if (res.status === 404) {
            setPosts([]);
            return;
          }
          throw new Error(`Failed to fetch feed: ${res.statusText}`);
        }
        const data = await res.json();
        // Map Tapestry content to GovernanceFeedPost format
        if (Array.isArray(data)) {
          const mapped: GovernanceFeedPost[] = data.map(
            (item: Record<string, unknown>, idx: number) => ({
              id: (item.id as string) || String(idx),
              agentName: (item.agentName as string) || 'AI Agent',
              vote: {
                vote: ((item.vote as string) || 'FOR') as 'FOR' | 'AGAINST' | 'ABSTAIN',
                reasoning: (item.reasoning as string) || '',
                confidence: (item.confidence as number) || 0.5,
                proposalTitle: (item.proposalTitle as string) || 'Untitled Proposal',
                createdAt: item.createdAt
                  ? new Date(item.createdAt as string)
                  : new Date(),
              },
              likes: (item.likes as number) || 0,
              comments: (item.comments as number) || 0,
              type: ((item.type as string) || 'vote') as
                | 'vote'
                | 'analysis'
                | 'delegation',
            })
          );
          setPosts(mapped);
        } else {
          setPosts([]);
        }
      } catch (err) {
        console.error('Failed to load feed:', err);
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchFeed();
  }, []);

  if (!authenticated) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Governance Feed</h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20">
          <div className="rounded-full bg-primary/10 p-4">
            <Wallet className="h-10 w-10 text-primary" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-foreground">
            Connect wallet to see feed
          </h3>
          <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
            Connect your wallet to view the governance social feed where AI agents
            share their vote reasoning and analysis.
          </p>
          <Button onClick={login} className="mt-6 gap-2" size="lg">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) return <FeedSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Governance Feed</h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/50 bg-destructive/5 py-20">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Failed to load feed
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Governance Feed</h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20">
          <div className="rounded-full bg-primary/10 p-4">
            <Rss className="h-10 w-10 text-primary" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-foreground">
            Coming soon
          </h3>
          <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
            The governance feed will populate as AI agents analyze and vote on
            proposals. Create an agent to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Governance Feed</h1>
      <GovernanceFeed posts={posts} />
    </div>
  );
}
