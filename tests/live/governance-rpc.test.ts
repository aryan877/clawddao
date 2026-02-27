import { describe, it, expect } from 'vitest';

// The devnet realm from scripts/devnet-realm.json
const DEVNET_REALM = 'GeXo3Cj6YqYpVucqmAyaL2TPHD1sCGVx1uN9wm1i9GWj';
const DEVNET_PROPOSAL = '3D2FStH92TpCPTWooFK4H66ibDmdMka427cA8RsmrjZ2';

describe.skipIf(!process.env.LIVE_TEST)('Governance RPC Live', () => {
  it('fetches the devnet test realm', async () => {
    const { fetchRealm } = await import('@shared/lib/governance');
    const { realm, governances } = await fetchRealm(DEVNET_REALM);

    expect(realm).toBeDefined();
    expect(realm.publicKey).toBeDefined();
    expect(realm.publicKey.toBase58()).toBe(DEVNET_REALM);
    expect(Array.isArray(governances)).toBe(true);
  });

  it('fetches proposals for the devnet realm', async () => {
    const { fetchProposalsForRealm } = await import('@shared/lib/governance');
    const proposals = await fetchProposalsForRealm(DEVNET_REALM);

    expect(Array.isArray(proposals)).toBe(true);
    // Our devnet realm has at least 1 proposal
    expect(proposals.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches vote records for the devnet proposal', async () => {
    const { fetchVoteRecords } = await import('@shared/lib/governance');
    const records = await fetchVoteRecords(DEVNET_PROPOSAL);

    // May be empty if no votes cast, but should be an array
    expect(Array.isArray(records)).toBe(true);
  });

  it('serializes realm data to JSON-safe format', async () => {
    const { fetchRealm, serializeRealm } = await import('@shared/lib/governance');
    const { realm } = await fetchRealm(DEVNET_REALM);
    const serialized = serializeRealm(realm);

    expect(serialized.address).toBe(DEVNET_REALM);
    expect(typeof serialized.name).toBe('string');
    expect(typeof serialized.communityMint).toBe('string');
    // Verify it's JSON-serializable (no PublicKey objects, no BN)
    const json = JSON.stringify(serialized);
    expect(JSON.parse(json)).toEqual(serialized);
  });

  it('serializes proposals to JSON-safe format', async () => {
    const { fetchProposalsForRealm, serializeProposal } = await import(
      '@shared/lib/governance'
    );
    const proposals = await fetchProposalsForRealm(DEVNET_REALM);

    if (proposals.length > 0) {
      const serialized = serializeProposal(proposals[0]);
      expect(typeof serialized.address).toBe('string');
      expect(typeof serialized.title).toBe('string');
      expect(typeof serialized.status).toBe('string');
      expect(typeof serialized.forVotes).toBe('number');
      expect(typeof serialized.againstVotes).toBe('number');
      // Verify JSON-serializable
      const json = JSON.stringify(serialized);
      expect(JSON.parse(json)).toEqual(serialized);
    }
  });

  it('throws on invalid public key', async () => {
    const { fetchRealm } = await import('@shared/lib/governance');
    await expect(fetchRealm('not-a-valid-key')).rejects.toThrow();
  });
});
