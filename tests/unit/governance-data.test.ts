import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock governance-idl-sdk before importing the module under test
// ---------------------------------------------------------------------------
const mockGetRealmByPubkey = vi.fn();
const mockGetGovernanceAccountsByRealm = vi.fn();
const mockGetProposalsforGovernance = vi.fn();
const mockGetProposalByPubkey = vi.fn();
const mockGetVoteRecordsForProposal = vi.fn();
const mockGetTokenOwnerRecordsForRealm = vi.fn();

vi.mock('governance-idl-sdk', () => {
  class MockSplGovernance {
    getRealmByPubkey = mockGetRealmByPubkey;
    getGovernanceAccountsByRealm = mockGetGovernanceAccountsByRealm;
    getProposalsforGovernance = mockGetProposalsforGovernance;
    getProposalByPubkey = mockGetProposalByPubkey;
    getVoteRecordsForProposal = mockGetVoteRecordsForProposal;
    getTokenOwnerRecordsForRealm = mockGetTokenOwnerRecordsForRealm;
  }
  return { SplGovernance: MockSplGovernance };
});

// Mock @solana/web3.js Connection to avoid real RPC calls
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js');
  class MockConnection {}
  return {
    ...actual,
    Connection: MockConnection,
  };
});

// Use well-known Solana program addresses as valid public keys for testing.
const VALID_PUBKEY = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'; // SPL Governance
const VALID_PUBKEY2 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'; // SPL Token

// Import PublicKey after the mock so Connection is already mocked
// but PublicKey is still the real one (spread from importActual)
async function getPublicKey() {
  const { PublicKey } = await import('@solana/web3.js');
  return PublicKey;
}

async function makePubkey(address: string) {
  const PK = await getPublicKey();
  return new PK(address);
}

describe('governance (governance-data)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { clearGovernanceCache } = await import('@shared/lib/governance');
    clearGovernanceCache();
  });

  // -----------------------------------------------------------------------
  // fetchRealm
  // -----------------------------------------------------------------------
  describe('fetchRealm', () => {
    it('fetches realm and governance accounts', async () => {
      const pk1 = await makePubkey(VALID_PUBKEY);
      const pk2 = await makePubkey(VALID_PUBKEY2);

      const fakeRealm = {
        publicKey: pk1,
        name: 'TestRealm',
        communityMint: pk1,
        authority: pk1,
      };

      const fakeGovernances = [
        { publicKey: pk1 },
        { publicKey: pk2 },
      ];

      mockGetRealmByPubkey.mockResolvedValueOnce(fakeRealm);
      mockGetGovernanceAccountsByRealm.mockResolvedValueOnce(fakeGovernances);

      const { fetchRealm } = await import('@shared/lib/governance');
      const result = await fetchRealm(VALID_PUBKEY);

      expect(result.realm).toEqual(fakeRealm);
      expect(result.governances).toEqual(fakeGovernances);
      expect(mockGetRealmByPubkey).toHaveBeenCalledTimes(1);
      expect(mockGetGovernanceAccountsByRealm).toHaveBeenCalledTimes(1);
    });

    it('throws on invalid address', async () => {
      const { fetchRealm } = await import('@shared/lib/governance');
      await expect(fetchRealm('not-a-valid-pubkey')).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // fetchProposalsForRealm
  // -----------------------------------------------------------------------
  describe('fetchProposalsForRealm', () => {
    it('fetches proposals across multiple governances and flattens', async () => {
      const pk1 = await makePubkey(VALID_PUBKEY);
      const pk2 = await makePubkey(VALID_PUBKEY2);

      const gov1 = { publicKey: pk1 };
      const gov2 = { publicKey: pk2 };
      mockGetGovernanceAccountsByRealm.mockResolvedValueOnce([gov1, gov2]);

      const proposal1 = { publicKey: pk1, name: 'Prop1', state: { voting: {} } };
      const proposal2 = { publicKey: pk2, name: 'Prop2', state: { completed: {} } };

      mockGetProposalsforGovernance
        .mockResolvedValueOnce([proposal1])
        .mockResolvedValueOnce([proposal2]);

      const { fetchProposalsForRealm } = await import('@shared/lib/governance');
      const proposals = await fetchProposalsForRealm(VALID_PUBKEY);

      expect(proposals).toHaveLength(2);
      expect(proposals[0]).toEqual(proposal1);
      expect(proposals[1]).toEqual(proposal2);
    });

    it('returns empty array when no governances exist', async () => {
      mockGetGovernanceAccountsByRealm.mockResolvedValueOnce([]);

      const { fetchProposalsForRealm } = await import('@shared/lib/governance');
      const proposals = await fetchProposalsForRealm(VALID_PUBKEY);

      expect(proposals).toEqual([]);
    });

    it('continues fetching when one governance fails', async () => {
      const pk1 = await makePubkey(VALID_PUBKEY);
      const pk2 = await makePubkey(VALID_PUBKEY2);

      const gov1 = { publicKey: pk1 };
      const gov2 = { publicKey: pk2 };
      mockGetGovernanceAccountsByRealm.mockResolvedValueOnce([gov1, gov2]);

      const proposal = { publicKey: pk1, name: 'SurvivedProp' };
      mockGetProposalsforGovernance
        .mockRejectedValueOnce(new Error('RPC error'))
        .mockResolvedValueOnce([proposal]);

      const { fetchProposalsForRealm } = await import('@shared/lib/governance');
      const proposals = await fetchProposalsForRealm(VALID_PUBKEY);

      // The first governance fails gracefully, second succeeds
      expect(proposals).toHaveLength(1);
      expect(proposals[0]).toEqual(proposal);
    });
  });

  // -----------------------------------------------------------------------
  // fetchVoteRecords
  // -----------------------------------------------------------------------
  describe('fetchVoteRecords', () => {
    it('returns vote records for a proposal', async () => {
      const pk1 = await makePubkey(VALID_PUBKEY);
      const pk2 = await makePubkey(VALID_PUBKEY2);

      const fakeRecords = [
        {
          publicKey: pk1,
          proposal: pk1,
          governingTokenOwner: pk2,
          isRelinquished: false,
          voterWeight: { toNumber: () => 100 },
          vote: { approve: [[{ rank: 0, weightPercentage: 100 }]] },
        },
      ];
      mockGetVoteRecordsForProposal.mockResolvedValueOnce(fakeRecords);

      const { fetchVoteRecords } = await import('@shared/lib/governance');
      const records = await fetchVoteRecords(VALID_PUBKEY);

      expect(records).toHaveLength(1);
      expect(records[0].publicKey.toBase58()).toBe(VALID_PUBKEY);
      expect(mockGetVoteRecordsForProposal).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no votes exist', async () => {
      mockGetVoteRecordsForProposal.mockResolvedValueOnce([]);

      const { fetchVoteRecords } = await import('@shared/lib/governance');
      const records = await fetchVoteRecords(VALID_PUBKEY);

      expect(records).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Error handling for invalid addresses
  // -----------------------------------------------------------------------
  describe('error handling for invalid addresses', () => {
    it('fetchRealm throws for an invalid base58 address', async () => {
      const { fetchRealm } = await import('@shared/lib/governance');
      await expect(fetchRealm('zzzz-not-base58!')).rejects.toThrow();
    });

    it('fetchVoteRecords throws for an invalid address', async () => {
      const { fetchVoteRecords } = await import('@shared/lib/governance');
      await expect(fetchVoteRecords('invalid!!')).rejects.toThrow();
    });

    it('fetchProposalsForRealm throws for an invalid address', async () => {
      const { fetchProposalsForRealm } = await import('@shared/lib/governance');
      await expect(fetchProposalsForRealm('%%%')).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // serializeRealm / serializeProposal helpers
  // -----------------------------------------------------------------------
  describe('serializeRealm', () => {
    it('serializes realm data to plain JSON', async () => {
      const pk1 = await makePubkey(VALID_PUBKEY);
      const pk2 = await makePubkey(VALID_PUBKEY2);

      const { serializeRealm } = await import('@shared/lib/governance');
      const realm = {
        publicKey: pk1,
        name: 'MyDAO',
        communityMint: pk2,
        authority: pk1,
      };

      const serialized = serializeRealm(realm as any);

      expect(serialized.address).toBe(VALID_PUBKEY);
      expect(serialized.name).toBe('MyDAO');
      expect(serialized.communityMint).toBe(VALID_PUBKEY2);
      expect(serialized.authority).toBe(VALID_PUBKEY);
    });
  });

  describe('getProposalState', () => {
    it('extracts state name from Anchor-style enum', async () => {
      const { getProposalState } = await import('@shared/lib/governance');

      expect(getProposalState({ voting: {} })).toBe('voting');
      expect(getProposalState({ completed: {} })).toBe('completed');
      expect(getProposalState({ draft: {} })).toBe('draft');
      expect(getProposalState(null)).toBe('unknown');
      expect(getProposalState({})).toBe('unknown');
    });
  });
});
