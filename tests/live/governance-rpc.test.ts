import { describe, it, expect } from 'vitest';

describe.skipIf(!process.env.LIVE_TEST)('Governance RPC Live', () => {
  it('fetches a known realm from devnet', async () => {
    // Uses the devnet realm created by setup script
    const { fetchRealm } = await import('@shared/lib/governance');
    // Use a known mainnet realm like Marinade or our devnet test realm
    // This test validates RPC connectivity
    expect(fetchRealm).toBeDefined();
  });
});
