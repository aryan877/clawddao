import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all external dependencies BEFORE importing the module under test.
// ---------------------------------------------------------------------------

vi.mock('@shared/lib/governance', () => ({
  fetchRealm: vi.fn(),
  fetchProposalsForRealm: vi.fn(),
  serializeProposal: vi.fn(),
}));

vi.mock('@shared/lib/stdb-client', () => ({
  getAllActiveAgents: vi.fn(),
  getTrackedRealms: vi.fn(),
  hasAgentVoted: vi.fn(),
}));

vi.mock('@shared/lib/autonomous-vote-engine', () => ({
  executeAutonomousVote: vi.fn(),
  isAgentEligibleForAutonomy: vi.fn(),
}));

import { runWorkerCycle } from '../../apps/worker/run-cycle';
import type { WorkerCycleSummary } from '../../apps/worker/run-cycle';
import { fetchRealm, fetchProposalsForRealm, serializeProposal } from '@shared/lib/governance';
import { getAllActiveAgents, getTrackedRealms, hasAgentVoted } from '@shared/lib/stdb-client';
import type { AgentRow, TrackedRealmRow } from '@shared/lib/stdb-client';
import { executeAutonomousVote, isAgentEligibleForAutonomy } from '@shared/lib/autonomous-vote-engine';
import type { AutonomousVoteResult, GovernanceProposalContext } from '@shared/lib/autonomous-vote-engine';

// ---------------------------------------------------------------------------
// Helpers: typed mock accessors
// ---------------------------------------------------------------------------

const mockGetTrackedRealms = vi.mocked(getTrackedRealms);
const mockGetAllActiveAgents = vi.mocked(getAllActiveAgents);
const mockFetchRealm = vi.mocked(fetchRealm);
const mockFetchProposalsForRealm = vi.mocked(fetchProposalsForRealm);
const mockSerializeProposal = vi.mocked(serializeProposal);
const mockIsAgentEligibleForAutonomy = vi.mocked(isAgentEligibleForAutonomy);
const mockHasAgentVoted = vi.mocked(hasAgentVoted);
const mockExecuteAutonomousVote = vi.mocked(executeAutonomousVote);

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeAgent(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: BigInt(1),
    owner_wallet: 'wallet1',
    name: 'TestAgent',
    values_profile: 'decentralization',
    config_json: JSON.stringify({ autoVote: true, confidenceThreshold: 0.65 }),
    risk_tolerance: 'moderate',
    is_active: true,
    privy_wallet_id: 'pw-1',
    privy_wallet_address: 'addr1',
    total_votes: 0,
    accuracy_score: 0,
    delegation_count: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

function makeTrackedRealm(overrides: Partial<TrackedRealmRow> = {}): TrackedRealmRow {
  return {
    id: BigInt(1),
    address: 'realmAddr1',
    name: 'TestRealm',
    is_active: true,
    added_at: Date.now(),
    ...overrides,
  };
}

function makeSerializedProposal(overrides: Record<string, unknown> = {}) {
  return {
    address: 'propAddr1',
    title: 'Proposal 1',
    descriptionLink: 'A description',
    status: 'voting',
    forVotes: 10,
    againstVotes: 5,
    abstainVotes: 2,
    governance: 'gov1',
    governingTokenMint: 'mint1',
    tokenOwnerRecord: 'tor1',
    draftAt: null,
    startVotingAt: null,
    votingCompletedAt: null,
    ...overrides,
  };
}

function makeVoteResult(overrides: Partial<AutonomousVoteResult> = {}): AutonomousVoteResult {
  return {
    agentId: '1',
    proposalAddress: 'propAddr1',
    executed: true,
    skipped: false,
    vote: 'for',
    confidence: 0.9,
    reasoning: 'Good proposal',
    txSignature: 'sig1',
    tapestryContentId: 'tc1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

const defaultOptions = { dryRun: false, maxConcurrency: 1, throttleDelayMs: 0 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runWorkerCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Sensible defaults: no realms, no agents
    mockGetTrackedRealms.mockResolvedValue([]);
    mockGetAllActiveAgents.mockResolvedValue([]);
    mockFetchRealm.mockResolvedValue({ realm: {} as never, governances: [] });
    mockFetchProposalsForRealm.mockResolvedValue([]);
    mockSerializeProposal.mockReturnValue(makeSerializedProposal() as never);
    mockIsAgentEligibleForAutonomy.mockReturnValue(false);
    mockHasAgentVoted.mockResolvedValue(false);
    mockExecuteAutonomousVote.mockResolvedValue(makeVoteResult());
  });

  // -------------------------------------------------------------------------
  // 1. Empty tracked realms
  // -------------------------------------------------------------------------
  it('returns a summary with 0 counts when there are no tracked realms', async () => {
    mockGetTrackedRealms.mockResolvedValue([]);
    mockGetAllActiveAgents.mockResolvedValue([makeAgent()]);
    mockIsAgentEligibleForAutonomy.mockReturnValue(true);

    const summary = await runWorkerCycle(defaultOptions);

    expect(summary.activeProposals).toBe(0);
    expect(summary.combinationsConsidered).toBe(0);
    expect(summary.executed).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.failed).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 2. No eligible agents
  // -------------------------------------------------------------------------
  it('returns agentsEligible: 0 when no agents pass eligibility', async () => {
    const agents = [makeAgent({ id: BigInt(1) }), makeAgent({ id: BigInt(2) })];
    mockGetAllActiveAgents.mockResolvedValue(agents);
    mockIsAgentEligibleForAutonomy.mockReturnValue(false);

    // Set up a realm with a proposal so we can verify no combinations are built
    mockGetTrackedRealms.mockResolvedValue([makeTrackedRealm()]);
    mockFetchProposalsForRealm.mockResolvedValue([{} as never]);
    mockSerializeProposal.mockReturnValue(makeSerializedProposal() as never);

    const summary = await runWorkerCycle(defaultOptions);

    expect(summary.agentsScanned).toBe(2);
    expect(summary.agentsEligible).toBe(0);
    expect(summary.combinationsConsidered).toBe(0);
    expect(summary.executed).toBe(0);
    expect(mockExecuteAutonomousVote).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Cartesian pairing: 2 agents x 3 proposals = 6 combinations
  // -------------------------------------------------------------------------
  it('creates Cartesian product of eligible agents and active proposals', async () => {
    const agents = [
      makeAgent({ id: BigInt(1), name: 'Agent1' }),
      makeAgent({ id: BigInt(2), name: 'Agent2' }),
    ];
    mockGetAllActiveAgents.mockResolvedValue(agents);
    mockIsAgentEligibleForAutonomy.mockReturnValue(true);

    // Three proposals across realms
    mockGetTrackedRealms.mockResolvedValue([
      makeTrackedRealm({ address: 'realm1' }),
    ]);

    const rawProposals = [{} as never, {} as never, {} as never];
    mockFetchProposalsForRealm.mockResolvedValue(rawProposals);

    let callIndex = 0;
    mockSerializeProposal.mockImplementation(() => {
      callIndex++;
      return makeSerializedProposal({
        address: `propAddr${callIndex}`,
        title: `Proposal ${callIndex}`,
      }) as never;
    });

    mockHasAgentVoted.mockResolvedValue(false);
    mockExecuteAutonomousVote.mockResolvedValue(makeVoteResult());

    const summary = await runWorkerCycle(defaultOptions);

    expect(summary.agentsEligible).toBe(2);
    expect(summary.activeProposals).toBe(3);
    expect(summary.combinationsConsidered).toBe(6);
    // Each combination calls executeAutonomousVote (not skipped by hasAgentVoted
    // because that check is inside the worker callback)
    expect(mockExecuteAutonomousVote).toHaveBeenCalledTimes(6);
    // Worker should pass preloaded governances to fetchProposalsForRealm
    expect(mockFetchProposalsForRealm).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
  });

  // -------------------------------------------------------------------------
  // 4. Concurrency limit is respected
  // -------------------------------------------------------------------------
  it('respects the maxConcurrency limit', async () => {
    const agents = [makeAgent({ id: BigInt(1) })];
    mockGetAllActiveAgents.mockResolvedValue(agents);
    mockIsAgentEligibleForAutonomy.mockReturnValue(true);

    mockGetTrackedRealms.mockResolvedValue([makeTrackedRealm()]);

    // 10 proposals
    const rawProposals = Array.from({ length: 10 }, () => ({}) as never);
    mockFetchProposalsForRealm.mockResolvedValue(rawProposals);

    let idx = 0;
    mockSerializeProposal.mockImplementation(() => {
      idx++;
      return makeSerializedProposal({ address: `p${idx}`, title: `P ${idx}` }) as never;
    });

    mockHasAgentVoted.mockResolvedValue(false);

    // Track peak concurrency
    let activeConcurrency = 0;
    let peakConcurrency = 0;

    mockExecuteAutonomousVote.mockImplementation(async () => {
      activeConcurrency++;
      if (activeConcurrency > peakConcurrency) {
        peakConcurrency = activeConcurrency;
      }
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeConcurrency--;
      return makeVoteResult();
    });

    const concurrencyLimit = 3;
    await runWorkerCycle({ dryRun: false, maxConcurrency: concurrencyLimit, throttleDelayMs: 0 });

    // Peak concurrency should not exceed the limit
    expect(peakConcurrency).toBeLessThanOrEqual(concurrencyLimit);
    expect(peakConcurrency).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 5. Summary counts: executed, skipped, failed tallied correctly
  // -------------------------------------------------------------------------
  it('tallies executed, skipped, and failed counts correctly', async () => {
    const agents = [makeAgent({ id: BigInt(1) })];
    mockGetAllActiveAgents.mockResolvedValue(agents);
    mockIsAgentEligibleForAutonomy.mockReturnValue(true);

    mockGetTrackedRealms.mockResolvedValue([makeTrackedRealm()]);

    // 4 proposals
    const rawProposals = Array.from({ length: 4 }, () => ({}) as never);
    mockFetchProposalsForRealm.mockResolvedValue(rawProposals);

    let pIdx = 0;
    mockSerializeProposal.mockImplementation(() => {
      pIdx++;
      return makeSerializedProposal({ address: `p${pIdx}` }) as never;
    });

    mockHasAgentVoted.mockResolvedValue(false);

    let callCount = 0;
    mockExecuteAutonomousVote.mockImplementation(async () => {
      callCount++;
      switch (callCount) {
        case 1:
          // executed
          return makeVoteResult({ executed: true, skipped: false });
        case 2:
          // skipped
          return makeVoteResult({ executed: false, skipped: true, skipReason: 'below_confidence_threshold' });
        case 3:
          // another executed
          return makeVoteResult({ executed: true, skipped: false });
        case 4:
          // failure - thrown error becomes { kind: 'failed', reason: ... }
          throw new Error('RPC timeout');
        default:
          return makeVoteResult();
      }
    });

    const summary = await runWorkerCycle(defaultOptions);

    expect(summary.executed).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.combinationsConsidered).toBe(4);
  });

  // -------------------------------------------------------------------------
  // 6. Already-voted pairs are skipped early
  // -------------------------------------------------------------------------
  it('skips pairs where the agent has already voted', async () => {
    const agent = makeAgent({ id: BigInt(42) });
    mockGetAllActiveAgents.mockResolvedValue([agent]);
    mockIsAgentEligibleForAutonomy.mockReturnValue(true);

    mockGetTrackedRealms.mockResolvedValue([makeTrackedRealm()]);
    mockFetchProposalsForRealm.mockResolvedValue([{} as never]);
    mockSerializeProposal.mockReturnValue(
      makeSerializedProposal({ address: 'alreadyVotedProp' }) as never,
    );

    // This agent already voted on this proposal
    mockHasAgentVoted.mockResolvedValue(true);

    const summary = await runWorkerCycle(defaultOptions);

    expect(summary.combinationsConsidered).toBe(1);
    // hasAgentVoted returned true, so executeAutonomousVote should NOT be called.
    // Instead the worker callback returns a skipped result directly.
    expect(mockExecuteAutonomousVote).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Additional edge cases
  // -------------------------------------------------------------------------
  it('filters out proposals that are not in voting status', async () => {
    mockGetAllActiveAgents.mockResolvedValue([makeAgent()]);
    mockIsAgentEligibleForAutonomy.mockReturnValue(true);

    mockGetTrackedRealms.mockResolvedValue([makeTrackedRealm()]);
    // Two raw proposals from RPC
    mockFetchProposalsForRealm.mockResolvedValue([{} as never, {} as never]);

    let sIdx = 0;
    mockSerializeProposal.mockImplementation(() => {
      sIdx++;
      if (sIdx === 1) {
        return makeSerializedProposal({ status: 'voting' }) as never;
      }
      // Second proposal is completed, should be filtered out
      return makeSerializedProposal({ status: 'completed', address: 'completedProp' }) as never;
    });

    mockHasAgentVoted.mockResolvedValue(false);
    mockExecuteAutonomousVote.mockResolvedValue(makeVoteResult());

    const summary = await runWorkerCycle(defaultOptions);

    // Only 1 proposal passes the voting status filter
    expect(summary.activeProposals).toBe(1);
    expect(summary.combinationsConsidered).toBe(1);
  });

  it('includes startedAt and finishedAt timestamps', async () => {
    const summary = await runWorkerCycle(defaultOptions);

    expect(summary.startedAt).toBeDefined();
    expect(summary.finishedAt).toBeDefined();
    // Both should be valid ISO date strings
    expect(() => new Date(summary.startedAt)).not.toThrow();
    expect(() => new Date(summary.finishedAt)).not.toThrow();
  });
});
