import { describe, it, expect } from 'vitest';
import {
  getProposalState,
  serializeRealm,
  serializeProposal,
  serializeGovernance,
  serializeVoteRecord,
  serializeTokenOwnerRecord,
} from '@shared/lib/governance';

// ---------------------------------------------------------------------------
// Helpers to create mock SDK objects
//
// The governance-idl-sdk types use Anchor-style objects. Instead of creating
// real PublicKey instances (which require valid base58 32-byte keys), we mock
// the shape used by the serialization functions.
// ---------------------------------------------------------------------------

function makeBN(value: number) {
  return { toNumber: () => value };
}

function mockPubkey(base58: string) {
  return { toBase58: () => base58 };
}

function mockRealmV2(overrides: Record<string, unknown> = {}) {
  return {
    publicKey: mockPubkey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'),
    name: 'Test Realm',
    communityMint: mockPubkey('B1hjjD1LjoUaVKAx9HADQeGSApLeqJxQ9SJQjHnDxBVp'),
    authority: mockPubkey('Cg8XMLSuEf5CUwnyr4GuM6mJRAPa9c1PJs6q3k5BmiM5'),
    ...overrides,
  };
}

function mockProposalV2(overrides: Record<string, unknown> = {}) {
  return {
    publicKey: mockPubkey('3D2FStH92TpCPTWooFK4H66ibDmdMka427cA8RsmrjZ2'),
    state: { voting: {} },
    options: [{ voteWeight: makeBN(5000) }],
    denyVoteWeight: makeBN(1200),
    abstainVoteWeight: makeBN(300),
    draftAt: makeBN(1700000000),
    startVotingAt: makeBN(1700001000),
    votingCompletedAt: null,
    governance: mockPubkey('4ENWttwbkPAbyrjdLkNGZ4iTf2bLsM8G98uDKpKGwqhK'),
    governingTokenMint: mockPubkey('B1hjjD1LjoUaVKAx9HADQeGSApLeqJxQ9SJQjHnDxBVp'),
    tokenOwnerRecord: mockPubkey('5f2LH9HCSb5a7iBBMPQbPKHQYsWFwUVGN899Qk2KfiU2'),
    name: 'Test Proposal',
    descriptionLink: 'https://example.com/proposal',
    ...overrides,
  };
}

function mockGovernanceAccount(overrides: Record<string, unknown> = {}) {
  return {
    publicKey: mockPubkey('4ENWttwbkPAbyrjdLkNGZ4iTf2bLsM8G98uDKpKGwqhK'),
    ...overrides,
  };
}

function mockVoteRecord(overrides: Record<string, unknown> = {}) {
  return {
    publicKey: mockPubkey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'),
    proposal: mockPubkey('3D2FStH92TpCPTWooFK4H66ibDmdMka427cA8RsmrjZ2'),
    governingTokenOwner: mockPubkey('Cg8XMLSuEf5CUwnyr4GuM6mJRAPa9c1PJs6q3k5BmiM5'),
    isRelinquished: false,
    voterWeight: makeBN(1000),
    vote: { approve: [[{ rank: 0, weightPercentage: 100 }]] },
    ...overrides,
  };
}

function mockTokenOwnerRecord(overrides: Record<string, unknown> = {}) {
  return {
    publicKey: mockPubkey('5f2LH9HCSb5a7iBBMPQbPKHQYsWFwUVGN899Qk2KfiU2'),
    governingTokenOwner: mockPubkey('Cg8XMLSuEf5CUwnyr4GuM6mJRAPa9c1PJs6q3k5BmiM5'),
    governingTokenMint: mockPubkey('B1hjjD1LjoUaVKAx9HADQeGSApLeqJxQ9SJQjHnDxBVp'),
    governingTokenDepositAmount: makeBN(50000),
    governanceDelegate: mockPubkey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getProposalState()
// ---------------------------------------------------------------------------
describe('getProposalState()', () => {
  it('extracts "voting" from { voting: {} }', () => {
    expect(getProposalState({ voting: {} })).toBe('voting');
  });

  it('extracts "draft" from { draft: {} }', () => {
    expect(getProposalState({ draft: {} })).toBe('draft');
  });

  it('extracts "completed" from { completed: {} }', () => {
    expect(getProposalState({ completed: {} })).toBe('completed');
  });

  it('extracts first key when multiple keys present', () => {
    const result = getProposalState({ succeeded: {}, voting: {} });
    // Object.keys returns keys in insertion order
    expect(result).toBe('succeeded');
  });

  it('returns "unknown" for null', () => {
    expect(getProposalState(null)).toBe('unknown');
  });

  it('returns "unknown" for undefined', () => {
    expect(getProposalState(undefined)).toBe('unknown');
  });

  it('returns "unknown" for empty object', () => {
    expect(getProposalState({})).toBe('unknown');
  });

  it('returns "unknown" for non-object values', () => {
    expect(getProposalState('voting')).toBe('unknown');
    expect(getProposalState(42)).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// serializeRealm()
// ---------------------------------------------------------------------------
describe('serializeRealm()', () => {
  it('serializes a realm to plain JSON', () => {
    const realm = mockRealmV2();
    const result = serializeRealm(realm as any);

    expect(result.address).toBe('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');
    expect(result.name).toBe('Test Realm');
    expect(result.communityMint).toBe('B1hjjD1LjoUaVKAx9HADQeGSApLeqJxQ9SJQjHnDxBVp');
    expect(result.authority).toBe('Cg8XMLSuEf5CUwnyr4GuM6mJRAPa9c1PJs6q3k5BmiM5');
  });

  it('handles null authority', () => {
    const realm = mockRealmV2({ authority: null });
    const result = serializeRealm(realm as any);
    expect(result.authority).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// serializeProposal()
// ---------------------------------------------------------------------------
describe('serializeProposal()', () => {
  it('serializes a proposal to plain JSON', () => {
    const proposal = mockProposalV2();
    const result = serializeProposal(proposal as any);

    expect(result.address).toBe('3D2FStH92TpCPTWooFK4H66ibDmdMka427cA8RsmrjZ2');
    expect(result.title).toBe('Test Proposal');
    expect(result.descriptionLink).toBe('https://example.com/proposal');
    expect(result.status).toBe('voting');
    expect(result.forVotes).toBe(5000);
    expect(result.againstVotes).toBe(1200);
    expect(result.abstainVotes).toBe(300);
    expect(result.governance).toBe('4ENWttwbkPAbyrjdLkNGZ4iTf2bLsM8G98uDKpKGwqhK');
    expect(result.governingTokenMint).toBe('B1hjjD1LjoUaVKAx9HADQeGSApLeqJxQ9SJQjHnDxBVp');
    expect(result.tokenOwnerRecord).toBe('5f2LH9HCSb5a7iBBMPQbPKHQYsWFwUVGN899Qk2KfiU2');
  });

  it('converts unix timestamps to ISO strings', () => {
    const proposal = mockProposalV2();
    const result = serializeProposal(proposal as any);

    expect(result.draftAt).toBe(new Date(1700000000 * 1000).toISOString());
    expect(result.startVotingAt).toBe(new Date(1700001000 * 1000).toISOString());
  });

  it('returns null for missing timestamps', () => {
    const proposal = mockProposalV2({
      draftAt: null,
      startVotingAt: null,
      votingCompletedAt: null,
    });
    const result = serializeProposal(proposal as any);

    expect(result.draftAt).toBeNull();
    expect(result.startVotingAt).toBeNull();
    expect(result.votingCompletedAt).toBeNull();
  });

  it('defaults forVotes to 0 when options is empty', () => {
    const proposal = mockProposalV2({ options: [] });
    const result = serializeProposal(proposal as any);
    expect(result.forVotes).toBe(0);
  });

  it('defaults againstVotes to 0 when denyVoteWeight is null', () => {
    const proposal = mockProposalV2({ denyVoteWeight: null });
    const result = serializeProposal(proposal as any);
    expect(result.againstVotes).toBe(0);
  });

  it('defaults abstainVotes to 0 when abstainVoteWeight is null', () => {
    const proposal = mockProposalV2({ abstainVoteWeight: null });
    const result = serializeProposal(proposal as any);
    expect(result.abstainVotes).toBe(0);
  });

  it('defaults title to empty string when name is undefined', () => {
    const proposal = mockProposalV2({ name: undefined });
    const result = serializeProposal(proposal as any);
    expect(result.title).toBe('');
  });

  it('defaults descriptionLink to empty string when undefined', () => {
    const proposal = mockProposalV2({ descriptionLink: undefined });
    const result = serializeProposal(proposal as any);
    expect(result.descriptionLink).toBe('');
  });
});

// ---------------------------------------------------------------------------
// serializeGovernance()
// ---------------------------------------------------------------------------
describe('serializeGovernance()', () => {
  it('serializes governance account to address only', () => {
    const gov = mockGovernanceAccount();
    const result = serializeGovernance(gov as any);
    expect(result.address).toBe('4ENWttwbkPAbyrjdLkNGZ4iTf2bLsM8G98uDKpKGwqhK');
  });
});

// ---------------------------------------------------------------------------
// serializeVoteRecord()
// ---------------------------------------------------------------------------
describe('serializeVoteRecord()', () => {
  it('serializes a vote record to plain JSON', () => {
    const vr = mockVoteRecord();
    const result = serializeVoteRecord(vr as any);

    expect(result.address).toBe('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
    expect(result.proposal).toBe('3D2FStH92TpCPTWooFK4H66ibDmdMka427cA8RsmrjZ2');
    expect(result.governingTokenOwner).toBe('Cg8XMLSuEf5CUwnyr4GuM6mJRAPa9c1PJs6q3k5BmiM5');
    expect(result.isRelinquished).toBe(false);
    expect(result.voterWeight).toBe(1000);
    expect(result.vote).toEqual({ approve: [[{ rank: 0, weightPercentage: 100 }]] });
  });

  it('defaults isRelinquished to false when undefined', () => {
    const vr = mockVoteRecord({ isRelinquished: undefined });
    const result = serializeVoteRecord(vr as any);
    expect(result.isRelinquished).toBe(false);
  });

  it('defaults voterWeight to 0 when null', () => {
    const vr = mockVoteRecord({ voterWeight: null });
    const result = serializeVoteRecord(vr as any);
    expect(result.voterWeight).toBe(0);
  });

  it('handles null proposal', () => {
    const vr = mockVoteRecord({ proposal: null });
    const result = serializeVoteRecord(vr as any);
    expect(result.proposal).toBe('');
  });
});

// ---------------------------------------------------------------------------
// serializeTokenOwnerRecord()
// ---------------------------------------------------------------------------
describe('serializeTokenOwnerRecord()', () => {
  it('serializes a token owner record to plain JSON', () => {
    const tor = mockTokenOwnerRecord();
    const result = serializeTokenOwnerRecord(tor as any);

    expect(result.address).toBe('5f2LH9HCSb5a7iBBMPQbPKHQYsWFwUVGN899Qk2KfiU2');
    expect(result.governingTokenOwner).toBe('Cg8XMLSuEf5CUwnyr4GuM6mJRAPa9c1PJs6q3k5BmiM5');
    expect(result.governingTokenMint).toBe('B1hjjD1LjoUaVKAx9HADQeGSApLeqJxQ9SJQjHnDxBVp');
    expect(result.governingTokenDepositAmount).toBe(50000);
    expect(result.governanceDelegate).toBe('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  });

  it('returns null for missing governanceDelegate', () => {
    const tor = mockTokenOwnerRecord({ governanceDelegate: null });
    const result = serializeTokenOwnerRecord(tor as any);
    expect(result.governanceDelegate).toBeNull();
  });

  it('defaults governingTokenDepositAmount to 0 when null', () => {
    const tor = mockTokenOwnerRecord({ governingTokenDepositAmount: null });
    const result = serializeTokenOwnerRecord(tor as any);
    expect(result.governingTokenDepositAmount).toBe(0);
  });

  it('handles null governingTokenOwner', () => {
    const tor = mockTokenOwnerRecord({ governingTokenOwner: null });
    const result = serializeTokenOwnerRecord(tor as any);
    expect(result.governingTokenOwner).toBe('');
  });
});
