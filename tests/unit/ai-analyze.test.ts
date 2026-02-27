import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '../helpers';
import { makeAuthRequest, VALID_USER_ID } from '../fixtures';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@shared/lib/auth', () => ({
  verifyAuth: vi.fn(),
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@shared/lib/ai', () => ({
  analyzeProposal: vi.fn(),
}));

import { verifyAuth, AuthError } from '@shared/lib/auth';
import { analyzeProposal } from '@shared/lib/ai';
import { POST } from '@/app/api/ai/analyze/route';

const mockVerifyAuth = vi.mocked(verifyAuth);
const mockAnalyzeProposal = vi.mocked(analyzeProposal);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAnalyzeRequest(body: unknown, authenticated = true) {
  if (authenticated) {
    return makeAuthRequest('http://localhost:3000/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  return new Request('http://localhost:3000/api/ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/ai/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    mockVerifyAuth.mockRejectedValue(new AuthError('Missing Authorization header'));

    const request = makeAnalyzeRequest(
      { title: 'Test', description: 'Desc', realmName: 'DAO' },
      false,
    );
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(401);
    expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 400 when required fields are missing', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeAnalyzeRequest({ title: 'Test' }); // missing description, realmName
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Missing required fields'),
      }),
    );
  });

  it('returns 400 when description is missing', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeAnalyzeRequest({ title: 'Test', realmName: 'DAO' });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Missing required fields'),
      }),
    );
  });

  it('returns analysis on success', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const analysis = {
      summary: 'A proposal to allocate funds for developer grants.',
      risk_assessment: {
        treasury_impact: 'moderate',
        security_risk: 'low',
        centralization_risk: 'low',
        overall_risk_score: 35,
      },
      recommendation: {
        vote: 'FOR',
        confidence: 0.88,
        reasoning: 'Developer grants encourage ecosystem growth.',
        conditions: ['Ensure milestone-based disbursement'],
      },
    };
    mockAnalyzeProposal.mockResolvedValue(analysis as never);

    const request = makeAnalyzeRequest({
      title: 'Fund Developer Grants',
      description: 'Allocate 10K SOL to developer grants program.',
      realmName: 'TestDAO',
      forVotes: 1000,
      againstVotes: 200,
    });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(analysis);
    expect(mockAnalyzeProposal).toHaveBeenCalledWith({
      title: 'Fund Developer Grants',
      description: 'Allocate 10K SOL to developer grants program.',
      realmName: 'TestDAO',
      forVotes: 1000,
      againstVotes: 200,
    });
  });

  it('defaults forVotes and againstVotes to 0 when not provided', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockAnalyzeProposal.mockResolvedValue({ summary: 'ok' } as never);

    const request = makeAnalyzeRequest({
      title: 'Simple Proposal',
      description: 'A simple change.',
      realmName: 'TestDAO',
    });
    await POST(request as never);

    expect(mockAnalyzeProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        forVotes: 0,
        againstVotes: 0,
      }),
    );
  });
});
