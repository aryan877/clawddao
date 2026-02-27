import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the socialfi SDK before importing the module under test
// ---------------------------------------------------------------------------
const mockProfiles = {
  findOrCreateCreate: vi.fn(),
  profilesDetail: vi.fn(),
};

const mockContents = {
  findOrCreateCreate: vi.fn(),
  contentsList: vi.fn(),
};

const mockSearch = {
  profilesList: vi.fn(),
};

const mockActivity = {
  feedList: vi.fn(),
};

const mockFollowers = {
  postFollowers: vi.fn(),
  removeCreate: vi.fn(),
  stateList: vi.fn(),
};

vi.mock('socialfi', () => {
  class MockSocialFi {
    profiles = mockProfiles;
    contents = mockContents;
    search = mockSearch;
    activity = mockActivity;
    followers = mockFollowers;
  }
  return { SocialFi: MockSocialFi };
});

describe('tapestry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getOrCreateProfile
  // -----------------------------------------------------------------------
  describe('getOrCreateProfile', () => {
    it('calls SDK findOrCreateCreate with correct params', async () => {
      const mockProfile = {
        profile: { id: 'profile-123', username: 'agent-alpha' },
      };
      mockProfiles.findOrCreateCreate.mockResolvedValueOnce(mockProfile);

      const { getOrCreateProfile } = await import('@shared/lib/tapestry');
      const result = await getOrCreateProfile('wallet-abc', 'agent-alpha');

      expect(result).toEqual(mockProfile);
      expect(mockProfiles.findOrCreateCreate).toHaveBeenCalledTimes(1);

      const [authArg, dataArg] = mockProfiles.findOrCreateCreate.mock.calls[0];
      expect(authArg).toHaveProperty('apiKey');
      expect(dataArg.walletAddress).toBe('wallet-abc');
      expect(dataArg.username).toBe('agent-alpha');
      expect(dataArg.blockchain).toBe('SOLANA');
    });

    it('throws when SDK call fails', async () => {
      mockProfiles.findOrCreateCreate.mockRejectedValueOnce(
        new Error('Tapestry API down'),
      );

      const { getOrCreateProfile } = await import('@shared/lib/tapestry');
      await expect(getOrCreateProfile('w', 'u')).rejects.toThrow('Tapestry API down');
    });
  });

  // -----------------------------------------------------------------------
  // postVoteReasoning
  // -----------------------------------------------------------------------
  describe('postVoteReasoning', () => {
    it('posts content with correct properties', async () => {
      const mockContent = { id: 'content-xyz' };
      mockContents.findOrCreateCreate.mockResolvedValueOnce(mockContent);

      const { postVoteReasoning } = await import('@shared/lib/tapestry');
      const result = await postVoteReasoning(
        'profile-123',
        'proposal-abc',
        'agent-42',
        'FOR',
        'Strong treasury proposal',
        0.92,
      );

      expect(result).toEqual(mockContent);
      expect(mockContents.findOrCreateCreate).toHaveBeenCalledTimes(1);

      const [authArg, dataArg] = mockContents.findOrCreateCreate.mock.calls[0];
      expect(authArg).toHaveProperty('apiKey');
      expect(dataArg.profileId).toBe('profile-123');
      expect(dataArg.id).toContain('vote-proposal-abc-agent-42');

      // Verify properties array
      const props = dataArg.properties as Array<{ key: string; value: string }>;
      expect(props).toEqual(
        expect.arrayContaining([
          { key: 'type', value: 'vote_reasoning' },
          { key: 'vote', value: 'FOR' },
          { key: 'reasoning', value: 'Strong treasury proposal' },
          { key: 'confidence', value: '0.92' },
          { key: 'proposalAddress', value: 'proposal-abc' },
          { key: 'agentId', value: 'agent-42' },
        ]),
      );
    });

    it('throws when SDK call fails', async () => {
      mockContents.findOrCreateCreate.mockRejectedValueOnce(
        new Error('Content creation failed'),
      );

      const { postVoteReasoning } = await import('@shared/lib/tapestry');
      await expect(
        postVoteReasoning('p', 'prop', 'a', 'FOR', 'reason', 0.5),
      ).rejects.toThrow('Content creation failed');
    });
  });

  // -----------------------------------------------------------------------
  // getContents
  // -----------------------------------------------------------------------
  describe('getContents', () => {
    it('fetches content list without profile filter', async () => {
      const mockList = { contents: [{ id: 'c1' }, { id: 'c2' }] };
      mockContents.contentsList.mockResolvedValueOnce(mockList);

      const { getContents } = await import('@shared/lib/tapestry');
      const result = await getContents();

      expect(result).toEqual(mockList);
      expect(mockContents.contentsList).toHaveBeenCalledTimes(1);

      const callArg = mockContents.contentsList.mock.calls[0][0];
      expect(callArg).toHaveProperty('apiKey');
      expect(callArg.profileId).toBeUndefined();
    });

    it('fetches content filtered by profileId', async () => {
      const mockList = { contents: [{ id: 'c1' }] };
      mockContents.contentsList.mockResolvedValueOnce(mockList);

      const { getContents } = await import('@shared/lib/tapestry');
      const result = await getContents('profile-123');

      expect(result).toEqual(mockList);
      const callArg = mockContents.contentsList.mock.calls[0][0];
      expect(callArg.profileId).toBe('profile-123');
    });
  });

  // -----------------------------------------------------------------------
  // searchProfiles
  // -----------------------------------------------------------------------
  describe('searchProfiles', () => {
    it('calls search SDK with apiKey and query', async () => {
      const mockResults = {
        profiles: [
          { profile: { id: 'p1' }, walletAddress: 'wallet-1' },
        ],
      };
      mockSearch.profilesList.mockResolvedValueOnce(mockResults);

      const { searchProfiles } = await import('@shared/lib/tapestry');
      const result = await searchProfiles('agent-alpha');

      expect(result).toEqual(mockResults);
      expect(mockSearch.profilesList).toHaveBeenCalledTimes(1);

      const callArg = mockSearch.profilesList.mock.calls[0][0];
      expect(callArg).toHaveProperty('apiKey');
      expect(callArg.query).toBe('agent-alpha');
    });

    it('throws when search fails', async () => {
      mockSearch.profilesList.mockRejectedValueOnce(new Error('Search timeout'));

      const { searchProfiles } = await import('@shared/lib/tapestry');
      await expect(searchProfiles('test')).rejects.toThrow('Search timeout');
    });
  });
});
