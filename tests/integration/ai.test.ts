import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @anthropic-ai/sdk before importing the module under test
// ---------------------------------------------------------------------------
const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: mockCreate,
      stream: mockStream,
    };
  }
  return { default: MockAnthropic };
});

describe('ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // analyzeProposal
  // -----------------------------------------------------------------------
  describe('analyzeProposal', () => {
    it('returns structured analysis from Claude response', async () => {
      const analysisData = {
        summary: 'Proposal to allocate 1000 SOL for development grants.',
        risk_assessment: {
          treasury_impact: 'Moderate — 5% of treasury',
          security_risk: 'Low — standard multisig execution',
          centralization_risk: 'Low — distributed among 10 grantees',
          overall_risk_score: 25,
        },
        recommendation: {
          vote: 'FOR',
          confidence: 0.87,
          reasoning: 'Well-structured grant program with clear milestones.',
          conditions: ['Milestone-based disbursement must be enforced'],
        },
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: JSON.stringify(analysisData) },
        ],
      });

      const { analyzeProposal } = await import('@shared/lib/ai');
      const result = await analyzeProposal({
        title: 'Development Grants Program',
        description: 'Allocate 1000 SOL for developer grants',
        realmName: 'TestDAO',
        forVotes: 1000,
        againstVotes: 200,
      });

      expect(result.summary).toBe(analysisData.summary);
      expect(result.risk_assessment.overall_risk_score).toBe(25);
      expect(result.recommendation.vote).toBe('FOR');
      expect(result.recommendation.confidence).toBe(0.87);

      // Verify Claude was called with correct model and structure
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-sonnet-4-20250514');
      expect(callArgs.max_tokens).toBe(1024);
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].role).toBe('user');
    });

    it('extracts JSON from markdown code blocks', async () => {
      const analysisData = {
        summary: 'Test summary.',
        risk_assessment: {
          treasury_impact: 'None',
          security_risk: 'None',
          centralization_risk: 'None',
          overall_risk_score: 10,
        },
        recommendation: {
          vote: 'AGAINST',
          confidence: 0.5,
          reasoning: 'Insufficient details.',
          conditions: [],
        },
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '```json\n' + JSON.stringify(analysisData) + '\n```',
          },
        ],
      });

      const { analyzeProposal } = await import('@shared/lib/ai');
      const result = await analyzeProposal({
        title: 'Test Proposal',
        description: 'Test',
        realmName: 'DAO',
        forVotes: 0,
        againstVotes: 0,
      });

      expect(result.recommendation.vote).toBe('AGAINST');
    });

    it('includes agent values in system prompt when provided', async () => {
      const analysisData = {
        summary: 'Summary',
        risk_assessment: {
          treasury_impact: 'Low',
          security_risk: 'Low',
          centralization_risk: 'Low',
          overall_risk_score: 5,
        },
        recommendation: {
          vote: 'FOR',
          confidence: 0.9,
          reasoning: 'Aligned with values.',
          conditions: [],
        },
      };

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(analysisData) }],
      });

      const { analyzeProposal } = await import('@shared/lib/ai');
      await analyzeProposal(
        {
          title: 'Test',
          description: 'Test',
          realmName: 'DAO',
          forVotes: 0,
          againstVotes: 0,
        },
        'Prioritize transparency and decentralization',
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system).toContain('transparency and decentralization');
    });
  });

  // -----------------------------------------------------------------------
  // generateAgentConfig
  // -----------------------------------------------------------------------
  describe('generateAgentConfig', () => {
    it('returns config object from Claude response', async () => {
      const configData = {
        values: ['transparency', 'security', 'decentralization'],
        riskTolerance: 'moderate',
        autoVote: true,
        confidenceThreshold: 0.75,
        focusAreas: ['treasury management', 'protocol upgrades'],
      };

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(configData) }],
      });

      const { generateAgentConfig } = await import('@shared/lib/ai');
      const result = await generateAgentConfig(
        'I care about transparency and security, moderate risk tolerance',
      );

      expect(result.values).toEqual(['transparency', 'security', 'decentralization']);
      expect(result.riskTolerance).toBe('moderate');
      expect(result.autoVote).toBe(true);
      expect(result.confidenceThreshold).toBe(0.75);
      expect(result.focusAreas).toContain('treasury management');

      // Verify model used
      expect(mockCreate.mock.calls[0][0].model).toBe('claude-sonnet-4-20250514');
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(512);
    });

    it('handles markdown-wrapped JSON', async () => {
      const configData = {
        values: ['innovation'],
        riskTolerance: 'aggressive',
        autoVote: false,
        confidenceThreshold: 0.5,
        focusAreas: ['DeFi'],
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: '```json\n' + JSON.stringify(configData) + '\n```' },
        ],
      });

      const { generateAgentConfig } = await import('@shared/lib/ai');
      const result = await generateAgentConfig('innovate aggressively');

      expect(result.riskTolerance).toBe('aggressive');
    });
  });

  // -----------------------------------------------------------------------
  // streamChat
  // -----------------------------------------------------------------------
  describe('streamChat', () => {
    it('returns async iterable stream from Anthropic SDK', async () => {
      const mockStreamResponse = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { text: ' world' } };
        },
      };

      mockStream.mockResolvedValueOnce(mockStreamResponse);

      const { streamChat } = await import('@shared/lib/ai');
      const stream = await streamChat([
        { role: 'user', content: 'What is a DAO?' },
      ]);

      expect(stream).toBeDefined();
      expect(mockStream).toHaveBeenCalledTimes(1);

      const callArgs = mockStream.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-sonnet-4-20250514');
      expect(callArgs.max_tokens).toBe(2048);
      expect(callArgs.messages).toEqual([
        { role: 'user', content: 'What is a DAO?' },
      ]);
    });

    it('includes system context when provided', async () => {
      mockStream.mockResolvedValueOnce({});

      const { streamChat } = await import('@shared/lib/ai');
      await streamChat(
        [{ role: 'user', content: 'Analyze this proposal' }],
        'Proposal: Allocate 500 SOL',
      );

      const callArgs = mockStream.mock.calls[0][0];
      expect(callArgs.system).toContain('Allocate 500 SOL');
    });
  });
});
