/**
 * Real integration tests against a live SpacetimeDB instance.
 *
 * These tests hit actual SpacetimeDB via HTTP — no mocks.
 * Run: npm run test:integration
 *
 * The globalSetup spins up Docker, publishes the module, and sets
 * SPACETIMEDB_URL + SPACETIMEDB_MODULE_NAME env vars.
 */
import { describe, it, expect, beforeAll } from 'vitest';

// Dynamic import so env vars from globalSetup are picked up
let stdb: typeof import('@shared/lib/stdb-client');

beforeAll(async () => {
  // Reset module cache to pick up test env vars
  stdb = await import('@shared/lib/stdb-client');
});

describe('SpacetimeDB Real CRUD', () => {
  // -------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------
  it('healthCheck returns true', async () => {
    const ok = await stdb.healthCheck();
    expect(ok).toBe(true);
  });

  // -------------------------------------------------------------------
  // Agent lifecycle: create → query → update → deactivate
  // -------------------------------------------------------------------
  describe('agent lifecycle', () => {
    it('creates an agent and queries it back', async () => {
      const result = await stdb.createAgent({
        name: 'IntegrationTestAgent',
        values_profile: 'transparency, security',
        config_json: JSON.stringify({ autoVote: true, confidenceThreshold: 0.7 }),
        risk_tolerance: 'moderate',
        owner_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        privy_wallet_id: 'test-pw-id',
        privy_wallet_address: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      });

      expect(result.ok).toBe(true);

      // Query it back
      const agents = await stdb.getAgentsByOwner('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      expect(agents.length).toBeGreaterThanOrEqual(1);

      const found = agents.find((a) => a.name === 'IntegrationTestAgent');
      expect(found).toBeDefined();
      expect(found!.is_active).toBe(true);
      expect(found!.total_votes).toBe(0);
    });

    it('getAllActiveAgents returns the created agent', async () => {
      const agents = await stdb.getAllActiveAgents();
      expect(agents.length).toBeGreaterThanOrEqual(1);

      const found = agents.find((a) => a.name === 'IntegrationTestAgent');
      expect(found).toBeDefined();
    });

    it('getAgentById returns the agent', async () => {
      const allAgents = await stdb.getAllActiveAgents();
      const testAgent = allAgents.find((a) => a.name === 'IntegrationTestAgent');
      expect(testAgent).toBeDefined();

      const agent = await stdb.getAgentById(testAgent!.id);
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('IntegrationTestAgent');
    });
  });

  // -------------------------------------------------------------------
  // Vote lifecycle: record → idempotency check → query
  // -------------------------------------------------------------------
  describe('vote lifecycle', () => {
    it('records a vote and checks idempotency', async () => {
      const agents = await stdb.getAllActiveAgents();
      const testAgent = agents.find((a) => a.name === 'IntegrationTestAgent');
      expect(testAgent).toBeDefined();

      const proposalAddr = 'test-proposal-integration-' + Date.now();

      // Record vote
      const result = await stdb.recordVote({
        agent_id: testAgent!.id,
        proposal_address: proposalAddr,
        vote: 'for',
        reasoning: 'Integration test vote',
        confidence: 0.85,
        tx_signature: 'test-tx-sig',
        tapestry_content_id: null,
      });
      expect(result.ok).toBe(true);

      // Check hasAgentVoted
      const voted = await stdb.hasAgentVoted(testAgent!.id, proposalAddr);
      expect(voted).toBe(true);

      // Second call with same agent+proposal should be idempotent (no error)
      const result2 = await stdb.recordVote({
        agent_id: testAgent!.id,
        proposal_address: proposalAddr,
        vote: 'for',
        reasoning: 'Duplicate — should merge',
        confidence: 0.85,
        tx_signature: null,
        tapestry_content_id: 'content-123',
      });
      expect(result2.ok).toBe(true);

      // Query the vote
      const votes = await stdb.getVotesByAgent(testAgent!.id);
      expect(votes.length).toBeGreaterThanOrEqual(1);

      const vote = votes.find((v) => v.proposal_address === proposalAddr);
      expect(vote).toBeDefined();
      expect(vote!.vote).toBe('for');
      // Idempotent merge: tx_signature from first call, tapestry_content_id from second
      expect(vote!.tx_signature).toBe('test-tx-sig');
      expect(vote!.tapestry_content_id).toBe('content-123');
    });

    it('hasAgentVoted returns false for unvoted proposal', async () => {
      const agents = await stdb.getAllActiveAgents();
      const testAgent = agents.find((a) => a.name === 'IntegrationTestAgent');
      const voted = await stdb.hasAgentVoted(testAgent!.id, 'nonexistent-proposal');
      expect(voted).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // AI Analysis: store → query
  // -------------------------------------------------------------------
  describe('AI analysis', () => {
    it('stores and retrieves an AI analysis', async () => {
      const agents = await stdb.getAllActiveAgents();
      const testAgent = agents.find((a) => a.name === 'IntegrationTestAgent');
      expect(testAgent).toBeDefined();

      const proposalAddr = 'analysis-test-' + Date.now();
      const analysisJson = JSON.stringify({
        summary: 'Test analysis',
        recommendation: { vote: 'FOR', confidence: 0.9 },
      });

      const result = await stdb.storeAIAnalysis({
        agent_id: testAgent!.id,
        proposal_address: proposalAddr,
        analysis_json: analysisJson,
        recommendation: 'FOR',
        confidence: 0.9,
      });
      expect(result.ok).toBe(true);

      const analysis = await stdb.getAIAnalysisByAgentAndProposal(testAgent!.id, proposalAddr);
      expect(analysis).not.toBeNull();
      expect(analysis!.recommendation).toBe('FOR');
      expect(analysis!.confidence).toBe(0.9);
    });
  });

  // -------------------------------------------------------------------
  // Delegation lifecycle: create → query → revoke
  // -------------------------------------------------------------------
  describe('delegation lifecycle', () => {
    it('creates, queries, and revokes a delegation', async () => {
      const agents = await stdb.getAllActiveAgents();
      const testAgent = agents.find((a) => a.name === 'IntegrationTestAgent');
      expect(testAgent).toBeDefined();

      const delegatorWallet = 'DelegatorWallet' + Date.now();
      const realmAddr = 'realm-test-' + Date.now();

      // Create delegation
      const result = await stdb.createDelegation({
        agent_id: testAgent!.id,
        realm_address: realmAddr,
        scope_bitmap: BigInt(1), // VOTE permission
        delegator_wallet: delegatorWallet,
      });
      expect(result.ok).toBe(true);

      // Query by wallet
      const delegations = await stdb.getDelegationsByWallet(delegatorWallet);
      expect(delegations.length).toBe(1);
      expect(delegations[0].realm_address).toBe(realmAddr);
      expect(delegations[0].is_active).toBe(true);

      // Revoke
      const revokeResult = await stdb.revokeDelegation(delegations[0].id);
      expect(revokeResult.ok).toBe(true);

      // Verify revoked (active delegations should be 0)
      const afterRevoke = await stdb.getDelegationsByWallet(delegatorWallet);
      expect(afterRevoke.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // Tracked realms: seed → query
  // -------------------------------------------------------------------
  describe('tracked realms', () => {
    it('seeds and queries tracked realms', async () => {
      const seedResult = await stdb.seedTrackedRealms();
      expect(seedResult.ok).toBe(true);

      const realms = await stdb.getTrackedRealms();
      expect(realms.length).toBeGreaterThanOrEqual(1);
      expect(realms[0]).toHaveProperty('address');
      expect(realms[0]).toHaveProperty('name');
      expect(realms[0].is_active).toBe(true);
    });

    it('addTrackedRealm is idempotent', async () => {
      const addr = 'test-realm-' + Date.now();
      await stdb.addTrackedRealm({ address: addr, name: 'Test Realm' });
      await stdb.addTrackedRealm({ address: addr, name: 'Test Realm' }); // no error

      const realms = await stdb.getTrackedRealms();
      const matches = realms.filter((r) => r.address === addr);
      expect(matches.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // SQL injection defense
  // -------------------------------------------------------------------
  describe('SQL injection defense', () => {
    it('handles injection attempt in wallet address', async () => {
      // This should not crash or return unrelated data
      const agents = await stdb.getAgentsByOwner("'; DROP TABLE agents;--");
      expect(Array.isArray(agents)).toBe(true);
      // If escaping works, this returns 0 results (no wallet matches the injection string)
      expect(agents.length).toBe(0);

      // Verify agents table still exists
      const allAgents = await stdb.getAllActiveAgents();
      expect(allAgents.length).toBeGreaterThanOrEqual(1);
    });
  });
});
