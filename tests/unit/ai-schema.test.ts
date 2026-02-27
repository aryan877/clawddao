import { describe, it, expect } from 'vitest';
import { GovernanceAnalysisSchema } from '@shared/lib/ai';

// ---------------------------------------------------------------------------
// Valid analysis
// ---------------------------------------------------------------------------
describe('GovernanceAnalysisSchema', () => {
  const validAnalysis = {
    summary: 'This proposal allocates 10K SOL to developer grants. It aims to grow the ecosystem.',
    risk_assessment: {
      treasury_impact: 'Moderate reduction of 10K SOL from treasury reserves.',
      security_risk: 'Low risk. Standard grant distribution mechanism.',
      centralization_risk: 'Low. Funds distributed to multiple recipients.',
      overall_risk_score: 25,
    },
    recommendation: {
      vote: 'FOR' as const,
      confidence: 0.85,
      reasoning: 'The proposal aligns with DAO growth objectives and has reasonable funding.',
      conditions: ['Ensure milestone-based fund release', 'Require quarterly reports'],
    },
  };

  it('accepts a valid analysis object', () => {
    const result = GovernanceAnalysisSchema.parse(validAnalysis);
    expect(result.summary).toBe(validAnalysis.summary);
    expect(result.risk_assessment.overall_risk_score).toBe(25);
    expect(result.recommendation.vote).toBe('FOR');
    expect(result.recommendation.confidence).toBe(0.85);
    expect(result.recommendation.conditions).toHaveLength(2);
  });

  it('accepts AGAINST vote', () => {
    const analysis = {
      ...validAnalysis,
      recommendation: {
        ...validAnalysis.recommendation,
        vote: 'AGAINST' as const,
      },
    };
    const result = GovernanceAnalysisSchema.parse(analysis);
    expect(result.recommendation.vote).toBe('AGAINST');
  });

  it('accepts ABSTAIN vote', () => {
    const analysis = {
      ...validAnalysis,
      recommendation: {
        ...validAnalysis.recommendation,
        vote: 'ABSTAIN' as const,
      },
    };
    const result = GovernanceAnalysisSchema.parse(analysis);
    expect(result.recommendation.vote).toBe('ABSTAIN');
  });

  it('accepts boundary values: risk_score=0, confidence=0', () => {
    const analysis = {
      ...validAnalysis,
      risk_assessment: {
        ...validAnalysis.risk_assessment,
        overall_risk_score: 0,
      },
      recommendation: {
        ...validAnalysis.recommendation,
        confidence: 0,
      },
    };
    const result = GovernanceAnalysisSchema.parse(analysis);
    expect(result.risk_assessment.overall_risk_score).toBe(0);
    expect(result.recommendation.confidence).toBe(0);
  });

  it('accepts boundary values: risk_score=100, confidence=1', () => {
    const analysis = {
      ...validAnalysis,
      risk_assessment: {
        ...validAnalysis.risk_assessment,
        overall_risk_score: 100,
      },
      recommendation: {
        ...validAnalysis.recommendation,
        confidence: 1,
      },
    };
    const result = GovernanceAnalysisSchema.parse(analysis);
    expect(result.risk_assessment.overall_risk_score).toBe(100);
    expect(result.recommendation.confidence).toBe(1);
  });

  it('accepts empty conditions array', () => {
    const analysis = {
      ...validAnalysis,
      recommendation: {
        ...validAnalysis.recommendation,
        conditions: [],
      },
    };
    const result = GovernanceAnalysisSchema.parse(analysis);
    expect(result.recommendation.conditions).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Missing fields
  // -------------------------------------------------------------------------
  it('rejects when summary is missing', () => {
    const { summary, ...rest } = validAnalysis;
    expect(() => GovernanceAnalysisSchema.parse(rest)).toThrow();
  });

  it('rejects when risk_assessment is missing', () => {
    const { risk_assessment, ...rest } = validAnalysis;
    expect(() => GovernanceAnalysisSchema.parse(rest)).toThrow();
  });

  it('rejects when recommendation is missing', () => {
    const { recommendation, ...rest } = validAnalysis;
    expect(() => GovernanceAnalysisSchema.parse(rest)).toThrow();
  });

  it('defaults treasury_impact when missing from risk_assessment', () => {
    const analysis = {
      ...validAnalysis,
      risk_assessment: {
        security_risk: 'None',
        centralization_risk: 'None',
        overall_risk_score: 10,
      },
    };
    const result = GovernanceAnalysisSchema.parse(analysis);
    expect(result.risk_assessment.treasury_impact).toBe('Unknown');
  });

  it('rejects when recommendation.vote is missing', () => {
    const analysis = {
      ...validAnalysis,
      recommendation: {
        confidence: 0.5,
        reasoning: 'test',
        conditions: [],
      },
    };
    expect(() => GovernanceAnalysisSchema.parse(analysis)).toThrow();
  });

  it('rejects when recommendation.reasoning is missing', () => {
    const analysis = {
      ...validAnalysis,
      recommendation: {
        vote: 'FOR',
        confidence: 0.5,
        conditions: [],
      },
    };
    expect(() => GovernanceAnalysisSchema.parse(analysis)).toThrow();
  });

  // -------------------------------------------------------------------------
  // Out-of-range values
  // -------------------------------------------------------------------------
  it('rejects overall_risk_score greater than 100', () => {
    const analysis = {
      ...validAnalysis,
      risk_assessment: {
        ...validAnalysis.risk_assessment,
        overall_risk_score: 101,
      },
    };
    expect(() => GovernanceAnalysisSchema.parse(analysis)).toThrow();
  });

  it('rejects overall_risk_score less than 0', () => {
    const analysis = {
      ...validAnalysis,
      risk_assessment: {
        ...validAnalysis.risk_assessment,
        overall_risk_score: -1,
      },
    };
    expect(() => GovernanceAnalysisSchema.parse(analysis)).toThrow();
  });

  it('rejects confidence greater than 1', () => {
    const analysis = {
      ...validAnalysis,
      recommendation: {
        ...validAnalysis.recommendation,
        confidence: 1.1,
      },
    };
    expect(() => GovernanceAnalysisSchema.parse(analysis)).toThrow();
  });

  it('rejects confidence less than 0', () => {
    const analysis = {
      ...validAnalysis,
      recommendation: {
        ...validAnalysis.recommendation,
        confidence: -0.1,
      },
    };
    expect(() => GovernanceAnalysisSchema.parse(analysis)).toThrow();
  });

  it('rejects invalid vote enum value', () => {
    const analysis = {
      ...validAnalysis,
      recommendation: {
        ...validAnalysis.recommendation,
        vote: 'MAYBE',
      },
    };
    expect(() => GovernanceAnalysisSchema.parse(analysis)).toThrow();
  });

  it('rejects non-string summary', () => {
    const analysis = {
      ...validAnalysis,
      summary: 123,
    };
    expect(() => GovernanceAnalysisSchema.parse(analysis)).toThrow();
  });

  it('rejects non-array conditions', () => {
    const analysis = {
      ...validAnalysis,
      recommendation: {
        ...validAnalysis.recommendation,
        conditions: 'not an array',
      },
    };
    expect(() => GovernanceAnalysisSchema.parse(analysis)).toThrow();
  });
});
