import { describe, it, expect } from 'vitest';

describe.skipIf(!process.env.LIVE_TEST)('Privy Auth Live', () => {
  it('validates Privy is configured', async () => {
    const { isConfigured } = await import('@shared/lib/privy-client');
    expect(isConfigured()).toBe(true);
  });
});
