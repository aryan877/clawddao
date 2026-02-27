import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all 5 dependencies
// ---------------------------------------------------------------------------

// 1. ai
const mockAnalyzeProposal = vi.fn();
vi.mock('@shared/lib/ai', () => ({
  analyzeProposal: mockAnalyzeProposal,
}));

// 2. solana-governance
const mockBuildCastVoteTransaction = vi.fn();
vi.mock('@shared/lib/solana-governance', () => ({
  buildCastVoteTransaction: mockBuildCastVoteTransaction,
}));

// 3. privy-client
const mockSignAndSendTransaction = vi.fn();
vi.mock('@shared/lib/privy-client', () => ({
  signAndSendTransaction: mockSignAndSendTransaction,
}));

// 4. tapestry
const mockGetOrCreateProfile = vi.fn();
const mockPostVoteReasoning = vi.fn();
vi.mock('@shared/lib/tapestry', () => ({
  getOrCreateProfile: mockGetOrCreateProfile,
  postVoteReasoning: mockPostVoteReasoning,
}));

// 5. stdb-client
const mockHasAgentVoted = vi.fn();
const mockRecordVote = vi.fn();
const mockStoreAIAnalysis = vi.fn();
vi.mock('@shared/lib/stdb-client', () => ({
  hasAgentVoted: mockHasAgentVoted,
  recordVote: mockRecordVote,
  storeAIAnalysis: mockStoreAIAnalysis,
}));

import type { AgentRow } from '@shared/lib/stdb-client';
import type { GovernanceProposalContext } from '@shared/lib/autonomous-vote-engine';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeAgent(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 1n,
    owner_wallet: 'owner-wallet',
    name: 'TestAgent',
    values_profile: 'transparency, security',
    config_json: JSON.stringify({
      autoVote: true,
      confidenceThreshold: 0.65,
      values: ['transparency', 'security'],
      focusAreas: ['treasury'],
    }),
    risk_tolerance: 'moderate',
    is_active: true,
    privy_wallet_id: 'pw-id-123',
    privy_wallet_address: 'pw-addr-456',
    total_votes: 5,
    accuracy_score: 0.8,
    delegation_count: 2,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

function makeProposal(overrides: Partial<GovernanceProposalContext> = {}): GovernanceProposalContext {
  return {
    address: 'proposal-abc',
    title: 'Grant Program',
    description: 'Allocate funds for developer grants',
    realmName: 'TestDAO',
    realmAddress: 'realmAddr1',
    forVotes: 1000,
    againstVotes: 200,
    status: 'voting',
    ...overrides,
  };
}

function makeAnalysis(vote: 'FOR' | 'AGAINST' | 'ABSTAIN' = 'FOR', confidence = 0.9) {
  return {
    summary: 'Test summary',
    risk_assessment: {
      treasury_impact: 'Low',
      security_risk: 'Low',
      centralization_risk: 'Low',
      overall_risk_score: 20,
    },
    recommendation: {
      vote,
      confidence,
      reasoning: 'Solid proposal aligned with DAO values.',
      conditions: [],
    },
  };
}

describe('autonomous-vote-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set TAPESTRY_API_KEY so the tapestry block runs
    process.env.TAPESTRY_API_KEY = 'test-tapestry-key';
  });

  // -----------------------------------------------------------------------
  // Full flow: eligible agent + voting proposal
  // -----------------------------------------------------------------------
  describe('full flow', () => {
    it('executes vote, posts to tapestry, records in STDB', async () => {
      const agent = makeAgent();
      const proposal = makeProposal();

      mockHasAgentVoted.mockResolvedValueOnce(false);
      mockAnalyzeProposal.mockResolvedValueOnce(makeAnalysis('FOR', 0.9));
      mockStoreAIAnalysis.mockResolvedValueOnce({ ok: true });
      mockBuildCastVoteTransaction.mockResolvedValueOnce({
        serializedTransaction: 'base64TxData123456',
      });
      mockSignAndSendTransaction.mockResolvedValueOnce({ txHash: 'tx-sig-xyz' });
      mockGetOrCreateProfile.mockResolvedValueOnce({
        profile: { id: 'tapestry-profile-1' },
      });
      mockPostVoteReasoning.mockResolvedValueOnce({ id: 'content-id-abc' });
      mockRecordVote.mockResolvedValueOnce({ ok: true });

      const { executeAutonomousVote } = await import(
        '@shared/lib/autonomous-vote-engine'
      );
      const result = await executeAutonomousVote({ agent, proposal });

      expect(result.executed).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.vote).toBe('for');
      expect(result.confidence).toBe(0.9);
      expect(result.txSignature).toBe('tx-sig-xyz');
      expect(result.tapestryContentId).toBe('content-id-abc');

      // Verify all dependencies were called
      expect(mockHasAgentVoted).toHaveBeenCalledWith(1n, 'proposal-abc');
      expect(mockAnalyzeProposal).toHaveBeenCalledTimes(1);
      expect(mockStoreAIAnalysis).toHaveBeenCalledTimes(1);
      expect(mockBuildCastVoteTransaction).toHaveBeenCalledWith({
        proposalAddress: 'proposal-abc',
        voterWalletAddress: 'pw-addr-456',
        voteDirection: 'for',
        realmAddress: 'realmAddr1',
      });
      expect(mockSignAndSendTransaction).toHaveBeenCalledWith({
        walletId: 'pw-id-123',
        agentId: '1',
        serializedTransaction: 'base64TxData123456',
      });
      expect(mockPostVoteReasoning).toHaveBeenCalledTimes(1);
      expect(mockRecordVote).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Skip: agent without wallet
  // -----------------------------------------------------------------------
  describe('skip scenarios', () => {
    it('skips when agent has no privy wallet', async () => {
      const agent = makeAgent({ privy_wallet_id: null, privy_wallet_address: null });
      const proposal = makeProposal();

      const { executeAutonomousVote } = await import(
        '@shared/lib/autonomous-vote-engine'
      );
      const result = await executeAutonomousVote({ agent, proposal });

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('agent_missing_privy_wallet');
      expect(result.executed).toBe(false);
      expect(mockAnalyzeProposal).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Skip: proposal not in voting state
    // -----------------------------------------------------------------------
    it('skips when proposal is not in voting state', async () => {
      const agent = makeAgent();
      const proposal = makeProposal({ status: 'completed' });

      const { executeAutonomousVote } = await import(
        '@shared/lib/autonomous-vote-engine'
      );
      const result = await executeAutonomousVote({ agent, proposal });

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('proposal_not_voting');
      expect(mockAnalyzeProposal).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Skip: already voted
    // -----------------------------------------------------------------------
    it('skips when agent already voted on proposal', async () => {
      const agent = makeAgent();
      const proposal = makeProposal();
      mockHasAgentVoted.mockResolvedValueOnce(true);

      const { executeAutonomousVote } = await import(
        '@shared/lib/autonomous-vote-engine'
      );
      const result = await executeAutonomousVote({ agent, proposal });

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('already_voted');
      expect(mockAnalyzeProposal).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Skip: autoVote disabled
    // -----------------------------------------------------------------------
    it('skips when autoVote is disabled', async () => {
      const agent = makeAgent({
        config_json: JSON.stringify({
          autoVote: false,
          confidenceThreshold: 0.65,
          values: [],
          focusAreas: [],
        }),
      });
      const proposal = makeProposal();
      mockHasAgentVoted.mockResolvedValueOnce(false);

      const { executeAutonomousVote } = await import(
        '@shared/lib/autonomous-vote-engine'
      );
      const result = await executeAutonomousVote({ agent, proposal });

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('auto_vote_disabled');
      expect(mockAnalyzeProposal).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Skip: below confidence threshold -> records abstain
    // -----------------------------------------------------------------------
    it('records abstain when confidence is below threshold', async () => {
      const agent = makeAgent({
        config_json: JSON.stringify({
          autoVote: true,
          confidenceThreshold: 0.8,
          values: ['transparency'],
          focusAreas: ['treasury'],
        }),
      });
      const proposal = makeProposal();

      mockHasAgentVoted.mockResolvedValueOnce(false);
      mockAnalyzeProposal.mockResolvedValueOnce(makeAnalysis('FOR', 0.5)); // below 0.8
      mockStoreAIAnalysis.mockResolvedValueOnce({ ok: true });
      mockRecordVote.mockResolvedValueOnce({ ok: true });

      const { executeAutonomousVote } = await import(
        '@shared/lib/autonomous-vote-engine'
      );
      const result = await executeAutonomousVote({ agent, proposal });

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('below_confidence_threshold');
      expect(result.vote).toBe('abstain');
      expect(result.confidence).toBe(0.5);

      // Should record the abstain vote in STDB
      expect(mockRecordVote).toHaveBeenCalledTimes(1);
      const recordCall = mockRecordVote.mock.calls[0][0];
      expect(recordCall.vote).toBe('abstain');
      expect(recordCall.confidence).toBe(0.5);

      // Should NOT have tried to execute on-chain
      expect(mockBuildCastVoteTransaction).not.toHaveBeenCalled();
      expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Dry run
  // -----------------------------------------------------------------------
  describe('dry run', () => {
    it('analyzes but does not execute on-chain vote', async () => {
      const agent = makeAgent();
      const proposal = makeProposal();

      mockHasAgentVoted.mockResolvedValueOnce(false);
      mockAnalyzeProposal.mockResolvedValueOnce(makeAnalysis('FOR', 0.9));
      mockStoreAIAnalysis.mockResolvedValueOnce({ ok: true });

      const { executeAutonomousVote } = await import(
        '@shared/lib/autonomous-vote-engine'
      );
      const result = await executeAutonomousVote({
        agent,
        proposal,
        dryRun: true,
      });

      expect(result.executed).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.vote).toBe('for');
      expect(result.confidence).toBe(0.9);
      expect(result.reasoning).toBe('Solid proposal aligned with DAO values.');

      // Analysis should have run
      expect(mockAnalyzeProposal).toHaveBeenCalledTimes(1);
      expect(mockStoreAIAnalysis).toHaveBeenCalledTimes(1);

      // But NO on-chain execution, tapestry post, or vote recording
      expect(mockBuildCastVoteTransaction).not.toHaveBeenCalled();
      expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
      expect(mockPostVoteReasoning).not.toHaveBeenCalled();
      expect(mockRecordVote).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Partial failures
  // -----------------------------------------------------------------------
  describe('partial failures', () => {
    it('does NOT record vote in STDB when on-chain tx fails', async () => {
      const agent = makeAgent();
      const proposal = makeProposal();

      mockHasAgentVoted.mockResolvedValueOnce(false);
      mockAnalyzeProposal.mockResolvedValueOnce(makeAnalysis('FOR', 0.9));
      mockStoreAIAnalysis.mockResolvedValueOnce({ ok: true });

      // On-chain tx fails
      mockBuildCastVoteTransaction.mockResolvedValueOnce({
        serializedTransaction: 'base64TxData123456',
      });
      mockSignAndSendTransaction.mockRejectedValueOnce(
        new Error('Privy signing failed'),
      );

      const { executeAutonomousVote } = await import(
        '@shared/lib/autonomous-vote-engine'
      );
      const result = await executeAutonomousVote({ agent, proposal });

      // On-chain failed — executed should be false
      expect(result.executed).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.vote).toBe('for');
      expect(result.txSignature).toBeNull();

      // STDB vote should NOT be recorded
      expect(mockRecordVote).not.toHaveBeenCalled();
      // Tapestry should NOT be called either
      expect(mockPostVoteReasoning).not.toHaveBeenCalled();
    });

    it('records vote even when tapestry post fails', async () => {
      const agent = makeAgent();
      const proposal = makeProposal();

      mockHasAgentVoted.mockResolvedValueOnce(false);
      mockAnalyzeProposal.mockResolvedValueOnce(makeAnalysis('AGAINST', 0.85));
      mockStoreAIAnalysis.mockResolvedValueOnce({ ok: true });

      // On-chain succeeds
      mockBuildCastVoteTransaction.mockResolvedValueOnce({
        serializedTransaction: 'base64TxData123456',
      });
      mockSignAndSendTransaction.mockResolvedValueOnce({ txHash: 'tx-ok' });

      // Tapestry fails
      mockGetOrCreateProfile.mockRejectedValueOnce(
        new Error('Tapestry API down'),
      );

      mockRecordVote.mockResolvedValueOnce({ ok: true });

      const { executeAutonomousVote } = await import(
        '@shared/lib/autonomous-vote-engine'
      );
      const result = await executeAutonomousVote({ agent, proposal });

      expect(result.executed).toBe(true);
      expect(result.txSignature).toBe('tx-ok');
      expect(result.tapestryContentId).toBeNull();

      // Vote still recorded
      expect(mockRecordVote).toHaveBeenCalledTimes(1);
    });
  });

});
