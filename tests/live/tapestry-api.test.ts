import { describe, it, expect } from 'vitest';

describe.skipIf(!process.env.LIVE_TEST)('Tapestry API Live', () => {
  it('can search profiles', async () => {
    const { searchProfiles } = await import('@shared/lib/tapestry');
    const results = await searchProfiles('test');

    expect(results).toBeDefined();
    // Results should be an object with profiles array
    expect(results).toHaveProperty('profiles');
  });

  it('can fetch contents list', async () => {
    const { getContents } = await import('@shared/lib/tapestry');
    const contents = await getContents();

    expect(contents).toBeDefined();
    // Should have a contents property (may be empty)
    expect(contents).toHaveProperty('contents');
    expect(Array.isArray(contents.contents)).toBe(true);
  });

  it('can create or find a profile', async () => {
    const { getOrCreateProfile } = await import('@shared/lib/tapestry');

    // Use the devnet payer wallet for a test profile
    const wallet = 'Cg8XMLSuEf5CUwnyr4GuM6mJRAPa9c1PJs6q3k5BmiM5';
    const username = `clawddao-test-${Date.now()}`;

    const result = await getOrCreateProfile(wallet, username);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('profile');
    expect(result.profile).toHaveProperty('id');
    expect(typeof result.profile.id).toBe('string');
  });

  it('can post and retrieve vote reasoning content', async () => {
    const { getOrCreateProfile, postVoteReasoning, getContents } = await import(
      '@shared/lib/tapestry'
    );

    const wallet = 'Cg8XMLSuEf5CUwnyr4GuM6mJRAPa9c1PJs6q3k5BmiM5';
    const profile = await getOrCreateProfile(wallet, `clawddao-live-${Date.now()}`);
    const profileId = profile?.profile?.id;
    if (!profileId) throw new Error('Failed to create profile');

    const content = await postVoteReasoning(
      profileId,
      'test-proposal-addr',
      'test-agent-1',
      'FOR',
      'This is a live test vote reasoning',
      0.85,
    );

    expect(content).toBeDefined();

    // Verify we can fetch contents back
    const allContents = await getContents(profileId);
    expect(allContents).toBeDefined();
  });
});
