import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '../helpers';
import { makeAuthRequest, makeAgent, makeDelegation, VALID_USER_ID } from '../fixtures';

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
  createDelegation: vi.fn(),
  getAgentById: vi.fn(),
  getDelegationsByWallet: vi.fn(),
}));

vi.mock('@shared/lib/constants', () => ({
  AGENT_PERMISSIONS: {
    VOTE: 1 << 0,
    CREATE_PROPOSAL: 1 << 1,
    TREASURY_VIEW: 1 << 2,
    TREASURY_EXEC: 1 << 3,
    DELEGATE: 1 << 4,
    STAKE: 1 << 5,
    TRADE: 1 << 6,
    ADMIN: 1 << 7,
  },
}));

import { verifyAuth, AuthError } from '@shared/lib/auth';
import {
  createDelegation,
  getAgentById,
  getDelegationsByWallet,
} from '@shared/lib/stdb-client';
import { GET, POST } from '@/app/api/delegations/route';

const mockVerifyAuth = vi.mocked(verifyAuth);
const mockCreateDelegation = vi.mocked(createDelegation);
const mockGetAgentById = vi.mocked(getAgentById);
const mockGetDelegationsByWallet = vi.mocked(getDelegationsByWallet);

// ─── Tests: GET ──────────────────────────────────────────────────────────────

describe('GET /api/delegations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    mockVerifyAuth.mockRejectedValue(new AuthError('Missing Authorization header'));

    const request = new Request('http://localhost:3000/api/delegations');
    const response = await GET(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(401);
    expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 400 when wallet query param is missing', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeAuthRequest('http://localhost:3000/api/delegations');
    const response = await GET(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('wallet'),
      }),
    );
  });

  it('returns delegations for a given wallet', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    const wallet = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    // Use JSON-serializable data (no BigInt) since NextResponse.json() calls JSON.stringify
    const delegations = [
      makeDelegation({ id: 1, agent_id: 1, scope_bitmap: 1 }),
      makeDelegation({ id: 2, agent_id: 2, scope_bitmap: 1 }),
    ];
    mockGetDelegationsByWallet.mockResolvedValue(delegations as never);

    const request = makeAuthRequest(
      `http://localhost:3000/api/delegations?wallet=${wallet}`,
    );
    const response = await GET(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(delegations);
    expect(mockGetDelegationsByWallet).toHaveBeenCalledWith(wallet);
  });
});

// ─── Tests: POST ─────────────────────────────────────────────────────────────

describe('POST /api/delegations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    mockVerifyAuth.mockRejectedValue(new AuthError('Missing Authorization header'));

    const request = new Request('http://localhost:3000/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: '1' }),
    });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(401);
    expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 400 when required fields are missing', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeAuthRequest('http://localhost:3000/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: '1' }), // missing realmAddress, delegatorWallet
    });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Missing required fields'),
      }),
    );
  });

  it('returns 404 when agent is not found', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockGetAgentById.mockResolvedValue(null as never);

    const request = makeAuthRequest('http://localhost:3000/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: '999',
        realmAddress: 'realm1111111111111111111111111111111111111111',
        delegatorWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      }),
    });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(404);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('999'),
      }),
    );
  });

  it('returns 201 on successful delegation creation', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockGetAgentById.mockResolvedValue(makeAgent() as never);
    mockCreateDelegation.mockResolvedValue({ ok: true } as never);

    const request = makeAuthRequest('http://localhost:3000/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: '1',
        realmAddress: 'realm1111111111111111111111111111111111111111',
        delegatorWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      }),
    });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(201);
    expect(body).toEqual({ success: true });
    expect(mockCreateDelegation).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: BigInt(1),
        realm_address: 'realm1111111111111111111111111111111111111111',
        delegator_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        scope_bitmap: BigInt(1), // AGENT_PERMISSIONS.VOTE = 1
      }),
    );
  });

  it('uses custom scopeBitmap when provided', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockGetAgentById.mockResolvedValue(makeAgent() as never);
    mockCreateDelegation.mockResolvedValue({ ok: true } as never);

    const request = makeAuthRequest('http://localhost:3000/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: '1',
        realmAddress: 'realm1111111111111111111111111111111111111111',
        delegatorWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        scopeBitmap: 3, // VOTE | CREATE_PROPOSAL
      }),
    });
    const response = await POST(request as never);

    expect(response.status).toBe(201);
    expect(mockCreateDelegation).toHaveBeenCalledWith(
      expect.objectContaining({
        scope_bitmap: BigInt(3),
      }),
    );
  });

  it('returns 500 when delegation creation fails in SpacetimeDB', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockGetAgentById.mockResolvedValue(makeAgent() as never);
    mockCreateDelegation.mockResolvedValue({
      ok: false,
      error: 'Reducer failed',
    } as never);

    const request = makeAuthRequest('http://localhost:3000/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: '1',
        realmAddress: 'realm1111111111111111111111111111111111111111',
        delegatorWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      }),
    });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(500);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Delegation creation failed'),
      }),
    );
  });
});
