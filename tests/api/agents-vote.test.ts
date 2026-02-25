import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '../helpers';
import { makeAuthRequest, makeAgent, VALID_USER_ID } from '../fixtures';

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

vi.mock('@shared/lib/stdb-client', () => ({
  getAgentById: vi.fn(),
}));

vi.mock('@shared/lib/autonomous-vote-engine', () => ({
  executeAutonomousVote: vi.fn(),
}));

import { verifyAuth, AuthError } from '@shared/lib/auth';
import { getAgentById } from '@shared/lib/stdb-client';
import { executeAutonomousVote } from '@shared/lib/autonomous-vote-engine';
import { POST } from '@/app/api/agents/[id]/vote/route';

const mockVerifyAuth = vi.mocked(verifyAuth);
const mockGetAgentById = vi.mocked(getAgentById);
const mockExecuteAutonomousVote = vi.mocked(executeAutonomousVote);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function callPOST(id: string, body: Record<string, unknown>, authenticated = true) {
  const request = authenticated
    ? makeAuthRequest('http://localhost:3000/api/agents/' + id + '/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    : new Request('http://localhost:3000/api/agents/' + id + '/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

  return POST(request, { params: Promise.resolve({ id }) });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/agents/[id]/vote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    mockVerifyAuth.mockRejectedValue(new AuthError('Missing Authorization header'));

    const response = await callPOST('1', { proposalAddress: 'abc' }, false);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(401);
    expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 404 when agent is not found', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockGetAgentById.mockResolvedValue(null as never);

    const response = await callPOST('999', {
      proposalAddress: 'proposal111111111111111111111111111111111111',
      proposalTitle: 'Test Proposal',
      realmName: 'TestDAO',
    });
    const { status, body } = await parseResponse(response);

    expect(status).toBe(404);
    expect(body).toEqual(
      expect.objectContaining({ error: expect.stringContaining('999') }),
    );
  });

  it('returns 400 when required fields are missing', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockGetAgentById.mockResolvedValue(makeAgent() as never);

    const response = await callPOST('1', {
      proposalAddress: 'proposal111111111111111111111111111111111111',
      // missing proposalTitle, realmName
    });
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Missing required fields'),
      }),
    );
  });

  it('returns vote result on success', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    const agent = makeAgent();
    mockGetAgentById.mockResolvedValue(agent as never);

    const voteResult = {
      vote: 'FOR',
      confidence: 0.92,
      reasoning: 'Strong proposal that aligns with DAO values',
      txSignature: 'sig123abc',
    };
    mockExecuteAutonomousVote.mockResolvedValue(voteResult as never);

    const response = await callPOST('1', {
      proposalAddress: 'proposal111111111111111111111111111111111111',
      proposalTitle: 'Fund dev grants',
      proposalDescription: 'Allocate 10K SOL to developer grants',
      realmName: 'TestDAO',
    });
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(voteResult);
    expect(mockExecuteAutonomousVote).toHaveBeenCalledWith({
      agent,
      proposal: expect.objectContaining({
        address: 'proposal111111111111111111111111111111111111',
        title: 'Fund dev grants',
        description: 'Allocate 10K SOL to developer grants',
        realmName: 'TestDAO',
        status: 'voting',
      }),
    });
  });

  it('uses proposalTitle as description fallback when description is missing', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockGetAgentById.mockResolvedValue(makeAgent() as never);
    mockExecuteAutonomousVote.mockResolvedValue({ vote: 'ABSTAIN' } as never);

    await callPOST('1', {
      proposalAddress: 'proposal111111111111111111111111111111111111',
      proposalTitle: 'Increase quorum',
      realmName: 'TestDAO',
    });

    expect(mockExecuteAutonomousVote).toHaveBeenCalledWith(
      expect.objectContaining({
        proposal: expect.objectContaining({
          description: 'Increase quorum', // falls back to title
        }),
      }),
    );
  });
});
