'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
  proposalItems: FeedItem[];
  reasoningItems: FeedItem[];
  realms: RealmResponse[];
  isLoading: boolean;
  isRefreshing: boolean;
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FeedFilter>('all');
  const [sort, setSort] = useState<FeedSort>('hot');
  const [activeRealm, setActiveRealm] = useState<string | null>(null);

  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background ?? false;

    try {
      if (background) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
        setError(null);
      }

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
        // Tapestry contentsList returns { contents: [...], page, pageSize, totalCount }
        // Each item: { authorProfile, content: { vote, reasoning, ... }, socialCounts }
        const items: unknown[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.contents)
            ? raw.contents
            : [];

        tapestryData = items.map(
          (entry: unknown, idx: number) => {
            const item = entry as Record<string, unknown>;
            const content = (item.content ?? item) as Record<string, unknown>;
            const author = item.authorProfile as Record<string, unknown> | undefined;
            const social = item.socialCounts as Record<string, unknown> | undefined;

            const voteStr = ((content.vote as string) || 'FOR').toUpperCase();

            return {
              id: (content.id as string) || String(idx),
              tapestryContentId: (item.id as string) || (content.id as string) || undefined,
              agentName:
                (content.agentName as string) ||
                (author?.username as string) ||
                'AI Agent',
              vote: {
                vote: voteStr as 'FOR' | 'AGAINST' | 'ABSTAIN',
                reasoning: (content.reasoning as string) || '',
                confidence: Number(content.confidence) || 0.5,
                proposalTitle:
                  (content.proposalTitle as string) ||
                  (content.proposalAddress
                    ? `Proposal ${(content.proposalAddress as string).slice(0, 8)}...`
                    : 'Untitled Proposal'),
                proposalAddress: (content.proposalAddress as string) || undefined,
                createdAt: content.created_at
                  ? new Date(content.created_at as number)
                  : content.createdAt
                    ? new Date(content.createdAt as string)
                    : new Date(),
              },
              likes: (social?.likeCount as number) || (social?.likes as number) || 0,
              comments: (social?.commentCount as number) || (social?.comments as number) || 0,
              type: ((content.type as string) === 'vote_reasoning' ? 'vote' : (content.type as string) || 'vote') as
                | 'vote'
                | 'analysis'
                | 'delegation',
            };
          },
        );
      }
      setPosts(tapestryData);
      hasLoadedOnce.current = true;
    } catch (err) {
      // Background refresh: don't replace existing data on error
      if (!background) {
        setError(err instanceof Error ? err.message : 'Failed to load feed');
      }
    } finally {
      if (background) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60s (background mode)
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasLoadedOnce.current) {
        fetchData({ background: true });
      }
    }, 60_000);
    return () => clearInterval(interval);
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

  // --- Separate lists for proposals and reasoning ---

  const proposalItems = useMemo(
    () => sortFeedItems(allItems.filter((i) => i.kind === 'proposal'), 'hot'),
    [allItems],
  );

  const reasoningItems = useMemo(
    () => sortFeedItems(allItems.filter((i) => i.kind === 'reasoning'), sort),
    [allItems, sort],
  );

  // --- Derived counts ---

  const totalProposals = proposalItems.length;
  const activeProposals = proposalItems.filter(
    (i) => i.kind === 'proposal' && i.proposal.status === 'voting',
  ).length;

  const refresh = useCallback(() => {
    fetchData({ background: hasLoadedOnce.current });
  }, [fetchData]);

  const value = useMemo<FeedContextValue>(
    () => ({
      items,
      proposalItems,
      reasoningItems,
      realms,
      isLoading,
      isRefreshing,
      error,
      filter,
      sort,
      setFilter,
      setSort,
      activeRealm,
      setActiveRealm,
      totalProposals,
      activeProposals,
      refresh,
    }),
    [
      items,
      proposalItems,
      reasoningItems,
      realms,
      isLoading,
      isRefreshing,
      error,
      filter,
      sort,
      activeRealm,
      totalProposals,
      activeProposals,
      refresh,
    ],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}
