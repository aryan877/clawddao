'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { Proposal } from '@shared/types/governance';
import type {
  FeedItem,
  FeedFilter,
  FeedSort,
  RealmResponse,
} from '@/lib/feed-types';
import { filterFeedItems, sortFeedItems } from '@/lib/feed-types';
import type { GovernanceFeedPost } from '@/components/social/GovernanceFeed';

// --- Map raw API proposal to domain Proposal ---

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

// --- Context shape ---

interface FeedContextValue {
  // Data
  items: FeedItem[];
  realms: RealmResponse[];
  isLoading: boolean;
  error: string | null;

  // Filter / sort state
  filter: FeedFilter;
  sort: FeedSort;
  setFilter: (f: FeedFilter) => void;
  setSort: (s: FeedSort) => void;

  // Active realm filter (null = all realms)
  activeRealm: string | null;
  setActiveRealm: (address: string | null) => void;

  // Derived counts
  totalProposals: number;
  activeProposals: number;

  // Refresh
  refresh: () => void;
}

const FeedContext = createContext<FeedContextValue | null>(null);

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used within FeedProvider');
  return ctx;
}

// --- Provider ---

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const [realms, setRealms] = useState<RealmResponse[]>([]);
  const [posts, setPosts] = useState<GovernanceFeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FeedFilter>('all');
  const [sort, setSort] = useState<FeedSort>('hot');
  const [activeRealm, setActiveRealm] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [realmsRes, tapestryRes] = await Promise.all([
        fetch('/api/governance/realms'),
        fetch('/api/tapestry/contents'),
      ]);

      if (!realmsRes.ok) throw new Error(`Realms: ${realmsRes.statusText}`);
      const realmsData: RealmResponse[] = await realmsRes.json();
      setRealms(realmsData);

      // Tapestry may 404 if no profile — that's fine
      let tapestryData: GovernanceFeedPost[] = [];
      if (tapestryRes.ok) {
        const raw = await tapestryRes.json();
        if (Array.isArray(raw)) {
          tapestryData = raw.map(
            (item: Record<string, unknown>, idx: number) => ({
              id: (item.id as string) || String(idx),
              agentName: (item.agentName as string) || 'AI Agent',
              vote: {
                vote: ((item.vote as string) || 'FOR') as
                  | 'FOR'
                  | 'AGAINST'
                  | 'ABSTAIN',
                reasoning: (item.reasoning as string) || '',
                confidence: (item.confidence as number) || 0.5,
                proposalTitle:
                  (item.proposalTitle as string) || 'Untitled Proposal',
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
            }),
          );
        }
      }
      setPosts(tapestryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Merge proposals + reasoning into unified feed ---

  const allItems = useMemo<FeedItem[]>(() => {
    const proposalItems: FeedItem[] = realms.flatMap((realm) =>
      realm.proposals.map((raw) => ({
        kind: 'proposal' as const,
        proposal: mapProposal(raw, realm.address),
        realmName: realm.name,
        realmAddress: realm.address,
        timestamp: raw.draftAt ? new Date(raw.draftAt) : new Date(),
      })),
    );

    const reasoningItems: FeedItem[] = posts.map((post) => ({
      kind: 'reasoning' as const,
      post,
      timestamp: new Date(post.vote.createdAt),
    }));

    return [...proposalItems, ...reasoningItems];
  }, [realms, posts]);

  // --- Apply realm filter, then feed filter + sort ---

  const items = useMemo(() => {
    let filtered = activeRealm
      ? allItems.filter(
          (item) =>
            item.kind === 'reasoning' ||
            (item.kind === 'proposal' && item.realmAddress === activeRealm),
        )
      : allItems;

    filtered = filterFeedItems(filtered, filter);
    return sortFeedItems(filtered, sort);
  }, [allItems, activeRealm, filter, sort]);

  // --- Derived counts ---

  const totalProposals = allItems.filter((i) => i.kind === 'proposal').length;
  const activeProposals = allItems.filter(
    (i) => i.kind === 'proposal' && i.proposal.status === 'voting',
  ).length;

  const value = useMemo<FeedContextValue>(
    () => ({
      items,
      realms,
      isLoading,
      error,
      filter,
      sort,
      setFilter,
      setSort,
      activeRealm,
      setActiveRealm,
      totalProposals,
      activeProposals,
      refresh: fetchData,
    }),
    [
      items,
      realms,
      isLoading,
      error,
      filter,
      sort,
      activeRealm,
      totalProposals,
      activeProposals,
      fetchData,
    ],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}
