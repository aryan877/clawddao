import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock openai SDK before importing the module under test
// ---------------------------------------------------------------------------
const mockCreate = vi.fn();

vi.mock('openai', () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  }
  return { default: MockOpenAI };
});

describe('ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // analyzeProposal
  // -----------------------------------------------------------------------
  describe('analyzeProposal', () => {
    it('returns structured analysis from GLM-5 response', async () => {
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
        choices: [
          { message: { content: JSON.stringify(analysisData) } },
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

      // Verify GLM-5 was called with correct model and structure
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('glm-5');
      expect(callArgs.max_tokens).toBe(2048);
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
    });

    it('extracts JSON from { } braces when not in code block', async () => {
      const analysisData = {
        summary: 'A small parameter change.',
        risk_assessment: {
          treasury_impact: 'None',
          security_risk: 'None',
          centralization_risk: 'None',
          overall_risk_score: 5,
        },
        recommendation: {
          vote: 'FOR',
          confidence: 0.95,
          reasoning: 'Trivial change with no risk.',
          conditions: [],
        },
      };

      // GLM-5 sometimes returns prose before/after the JSON object
      const mixedResponse = `Here is my analysis:\n${JSON.stringify(analysisData)}\n\nHope this helps!`;

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mixedResponse } }],
      });

      const { analyzeProposal } = await import('@shared/lib/ai');
      const result = await analyzeProposal({
        title: 'Param Change',
        description: 'Update fee to 0.1%',
        realmName: 'DAO',
        forVotes: 500,
        againstVotes: 10,
      });

      expect(result.recommendation.vote).toBe('FOR');
      expect(result.recommendation.confidence).toBe(0.95);
    });

    it('uses reasoning_content field when content is empty (GLM-5 deep think)', async () => {
      const analysisData = {
        summary: 'Deep think analysis.',
        risk_assessment: {
          treasury_impact: 'High',
          security_risk: 'Medium',
          centralization_risk: 'Low',
          overall_risk_score: 60,
        },
        recommendation: {
          vote: 'AGAINST',
          confidence: 0.7,
          reasoning: 'Too risky for treasury.',
          conditions: ['Need audit first'],
        },
      };

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              reasoning_content: JSON.stringify(analysisData),
            },
          },
        ],
      });

      const { analyzeProposal } = await import('@shared/lib/ai');
      const result = await analyzeProposal({
        title: 'Big Spend',
        description: 'Spend 50% of treasury',
        realmName: 'DAO',
        forVotes: 100,
        againstVotes: 900,
      });

      expect(result.recommendation.vote).toBe('AGAINST');
      expect(result.risk_assessment.overall_risk_score).toBe(60);
    });

    it('throws on invalid JSON response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'This is not JSON at all' } }],
      });

      const { analyzeProposal } = await import('@shared/lib/ai');
      await expect(
        analyzeProposal({
          title: 'Test',
          description: 'Test',
          realmName: 'DAO',
          forVotes: 0,
          againstVotes: 0,
        }),
      ).rejects.toThrow();
    });

    it('throws on JSON that fails Zod schema validation', async () => {
      // Valid JSON but missing required fields
      mockCreate.mockResolvedValueOnce({
        choices: [
          { message: { content: JSON.stringify({ summary: 'only summary' }) } },
        ],
      });

      const { analyzeProposal } = await import('@shared/lib/ai');
      await expect(
        analyzeProposal({
          title: 'Test',
          description: 'Test',
          realmName: 'DAO',
          forVotes: 0,
          againstVotes: 0,
        }),
      ).rejects.toThrow();
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
        choices: [
          {
            message: {
              content: '```json\n' + JSON.stringify(analysisData) + '\n```',
            },
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
        choices: [{ message: { content: JSON.stringify(analysisData) } }],
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
      const systemMsg = callArgs.messages.find((m: { role: string }) => m.role === 'system');
      expect(systemMsg.content).toContain('transparency and decentralization');
    });
  });

  // -----------------------------------------------------------------------
  // generateAgentConfig
  // -----------------------------------------------------------------------
  describe('generateAgentConfig', () => {
    it('returns config object from GLM-5 response', async () => {
      const configData = {
        values: ['transparency', 'security', 'decentralization'],
        riskTolerance: 'moderate',
        autoVote: true,
        confidenceThreshold: 0.75,
        focusAreas: ['treasury management', 'protocol upgrades'],
      };

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(configData) } }],
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
      expect(mockCreate.mock.calls[0][0].model).toBe('glm-5');
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
        choices: [
          { message: { content: '```json\n' + JSON.stringify(configData) + '\n```' } },
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
    it('returns stream from OpenAI SDK', async () => {
      const mockStreamResponse = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' world' } }] };
        },
      };

      mockCreate.mockResolvedValueOnce(mockStreamResponse);

      const { streamChat } = await import('@shared/lib/ai');
      const stream = await streamChat([
        { role: 'user', content: 'What is a DAO?' },
      ]);

      expect(stream).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('glm-5');
      expect(callArgs.max_tokens).toBe(2048);
      expect(callArgs.stream).toBe(true);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1]).toEqual(
        { role: 'user', content: 'What is a DAO?' },
      );
    });

    it('includes system context when provided', async () => {
      mockCreate.mockResolvedValueOnce({});

      const { streamChat } = await import('@shared/lib/ai');
      await streamChat(
        [{ role: 'user', content: 'Analyze this proposal' }],
        'Proposal: Allocate 500 SOL',
      );

      const callArgs = mockCreate.mock.calls[0][0];
      const systemMsg = callArgs.messages.find((m: { role: string }) => m.role === 'system');
      expect(systemMsg.content).toContain('Allocate 500 SOL');
    });
  });
});
