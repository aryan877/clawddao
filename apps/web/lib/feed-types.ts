import type { Proposal } from '@shared/types/governance';
import type { GovernanceFeedPost } from '@/components/social/GovernanceFeed';
export type { GovernanceFeedPost } from '@/components/social/GovernanceFeed';
export type { VoteReasoning } from '@/components/social/ReasoningPost';

// --- Feed item union ---

export type FeedItem =
  | {
      kind: 'proposal';
      proposal: Proposal;
      realmName: string;
      realmAddress: string;
      timestamp: Date;
    }
  | {
      kind: 'reasoning';
      post: GovernanceFeedPost;
      realmName?: string;
      timestamp: Date;
    };

// --- Filter / Sort ---

export type FeedFilter = 'all' | 'active' | 'new' | 'completed';
export type FeedSort = 'hot' | 'new' | 'top';

// --- Realm info from API ---

export interface RealmResponse {
  address: string;
  name: string;
  communityMint: string;
  authority: string;
  displayName?: string;
  governanceCount?: number;
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

// --- Helpers ---

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function filterFeedItems(items: FeedItem[], filter: FeedFilter): FeedItem[] {
  if (filter === 'all') return items;

  return items.filter((item) => {
    if (filter === 'active') {
      return item.kind === 'proposal' && item.proposal.status === 'voting';
    }
    if (filter === 'new') {
      return Date.now() - item.timestamp.getTime() < SEVEN_DAYS;
    }
    if (filter === 'completed') {
      if (item.kind !== 'proposal') return false;
      const s = item.proposal.status;
      return s === 'succeeded' || s === 'defeated' || s === 'completed';
    }
    return true;
  });
}

export function sortFeedItems(items: FeedItem[], sort: FeedSort): FeedItem[] {
  const sorted = [...items];

  if (sort === 'new') {
    return sorted.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  if (sort === 'top') {
    return sorted.sort((a, b) => {
      const votesA = a.kind === 'proposal'
        ? a.proposal.forVotes + a.proposal.againstVotes + (a.proposal.abstainVotes ?? 0)
        : 0;
      const votesB = b.kind === 'proposal'
        ? b.proposal.forVotes + b.proposal.againstVotes + (b.proposal.abstainVotes ?? 0)
        : 0;
      return votesB - votesA;
    });
  }

  // 'hot' — active proposals first, then by vote count
  return sorted.sort((a, b) => {
    const activeA = a.kind === 'proposal' && a.proposal.status === 'voting' ? 1 : 0;
    const activeB = b.kind === 'proposal' && b.proposal.status === 'voting' ? 1 : 0;
    if (activeB !== activeA) return activeB - activeA;

    const votesA = a.kind === 'proposal'
      ? a.proposal.forVotes + a.proposal.againstVotes + (a.proposal.abstainVotes ?? 0)
      : 0;
    const votesB = b.kind === 'proposal'
      ? b.proposal.forVotes + b.proposal.againstVotes + (b.proposal.abstainVotes ?? 0)
      : 0;
    return votesB - votesA;
  });
}
