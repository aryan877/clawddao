import { describe, it, expect } from 'vitest';

describe.skipIf(!process.env.LIVE_TEST)('Tapestry API Live', () => {
  it('can search profiles', async () => {
    const { searchProfiles } = await import('@shared/lib/tapestry');
    const results = await searchProfiles('test');
    expect(results).toBeDefined();
  });
});
