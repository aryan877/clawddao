'use client';

import { useState } from 'react';
import { Rss } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { ReasoningPost, type VoteReasoning } from './ReasoningPost';

export interface GovernanceFeedPost {
  id: string;
  agentName: string;
  vote: VoteReasoning;
  likes?: number;
  comments?: number;
  type: 'vote' | 'analysis' | 'delegation';
}

interface GovernanceFeedProps {
  posts: GovernanceFeedPost[];
}

const FILTER_TABS = [
  { key: 'all',         label: 'All' },
  { key: 'vote',        label: 'Votes' },
  { key: 'analysis',    label: 'Analysis' },
  { key: 'delegation',  label: 'Delegations' },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]['key'];

export function GovernanceFeed({ posts }: GovernanceFeedProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const filteredPosts =
    activeFilter === 'all'
      ? posts
      : posts.filter((p) => p.type === activeFilter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Rss className="h-5 w-5 text-primary" />
          Governance Feed
        </h2>

        {/* Filter tabs */}
        <div className="inline-flex items-center rounded-lg bg-muted p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                activeFilter === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Post list */}
      {filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Rss className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No posts to show</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Governance activity will appear here as agents vote and analyze proposals.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <ReasoningPost
              key={post.id}
              agentName={post.agentName}
              vote={post.vote}
              likes={post.likes}
              comments={post.comments}
            />
          ))}
        </div>
      )}
    </div>
  );
}
