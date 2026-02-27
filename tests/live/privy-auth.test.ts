import { describe, it, expect } from 'vitest';

describe.skipIf(!process.env.LIVE_TEST)('Privy Auth Live', () => {
  it('validates Privy credentials are configured', async () => {
    const { isConfigured } = await import('@shared/lib/privy-client');
    expect(isConfigured()).toBe(true);
  });

  it('can create a spending policy', async () => {
    const { isConfigured, createPolicy } = await import('@shared/lib/privy-client');
    if (!isConfigured()) return;

    const policy = await createPolicy({ maxSolPerTx: 0.01 });

    expect(policy).toBeDefined();
    expect(typeof policy.id).toBe('string');
    expect(policy.name).toBe('Agent voting policy');
    expect(Array.isArray(policy.rules)).toBe(true);
    expect(policy.rules.length).toBeGreaterThan(0);
  });

  it('can create and retrieve an agent wallet', async () => {
    const { isConfigured, createPolicy, createAgentWallet, getWallet } = await import(
      '@shared/lib/privy-client'
    );
    if (!isConfigured()) return;

    // Create a policy first
    const policy = await createPolicy({ maxSolPerTx: 0.01 });

    // Create wallet with that policy
    const wallet = await createAgentWallet({
      policyIds: [policy.id],
      label: 'Live Test Wallet',
    });

    expect(typeof wallet.id).toBe('string');
    expect(typeof wallet.address).toBe('string');
    expect(wallet.address.length).toBeGreaterThan(20); // Solana addresses are 32-44 chars

    // Fetch wallet back
    const fetched = await getWallet(wallet.id);
    expect(fetched.id).toBe(wallet.id);
    expect(fetched.address).toBe(wallet.address);
    expect(fetched.chain_type).toBe('solana');
  });
});
