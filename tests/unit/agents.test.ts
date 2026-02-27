import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseResponse } from '../helpers';
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
  getAllActiveAgents: vi.fn(),
  getAgentsByOwner: vi.fn(),
  createAgent: vi.fn(),
  healthCheck: vi.fn(),
}));

vi.mock('@shared/lib/privy-client', () => ({
  createPolicy: vi.fn(),
  createAgentWallet: vi.fn(),
}));

vi.mock('@shared/lib/tapestry', () => ({
  getOrCreateProfile: vi.fn(),
}));

vi.mock('@shared/lib/constants', () => ({
  SOLANA_CHAIN_CONFIG: { chainId: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' },
}));

import { verifyAuth, AuthError } from '@shared/lib/auth';
import {
  getAllActiveAgents,
  getAgentsByOwner,
  createAgent,
  healthCheck,
} from '@shared/lib/stdb-client';
import { createPolicy, createAgentWallet } from '@shared/lib/privy-client';
import { getOrCreateProfile } from '@shared/lib/tapestry';
import { GET, POST } from '@/app/api/agents/route';

const mockVerifyAuth = vi.mocked(verifyAuth);
const mockGetAllActiveAgents = vi.mocked(getAllActiveAgents);
const mockGetAgentsByOwner = vi.mocked(getAgentsByOwner);
const mockCreateAgent = vi.mocked(createAgent);
const mockHealthCheck = vi.mocked(healthCheck);
const mockCreatePolicy = vi.mocked(createPolicy);
const mockCreateAgentWallet = vi.mocked(createAgentWallet);
const mockGetOrCreateProfile = vi.mocked(getOrCreateProfile);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealthCheck.mockResolvedValue(true);
  });

  it('returns 401 without auth', async () => {
    mockVerifyAuth.mockRejectedValue(new AuthError('Missing Authorization header'));

    const request = createRequest('/api/agents');
    const response = await GET(request);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(401);
    expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns all active agents when no wallet param', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    // Use JSON-serializable data (no BigInt) since NextResponse.json() calls JSON.stringify
    const agents = [
      makeAgent({ id: 1 }),
      makeAgent({ id: 2, name: 'Agent Two' }),
    ];
    mockGetAllActiveAgents.mockResolvedValue(agents as never);

    const request = makeAuthRequest('http://localhost:3000/api/agents');
    const response = await GET(request);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(agents);
    expect(mockGetAllActiveAgents).toHaveBeenCalledOnce();
    expect(mockGetAgentsByOwner).not.toHaveBeenCalled();
  });

  it('returns filtered agents when wallet param provided', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    const wallet = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    // Use JSON-serializable data (no BigInt) since NextResponse.json() calls JSON.stringify
    const agents = [makeAgent({ id: 1, owner_wallet: wallet })];
    mockGetAgentsByOwner.mockResolvedValue(agents as never);

    const request = makeAuthRequest(
      `http://localhost:3000/api/agents?wallet=${wallet}`,
    );
    const response = await GET(request);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(agents);
    expect(mockGetAgentsByOwner).toHaveBeenCalledWith(wallet);
    expect(mockGetAllActiveAgents).not.toHaveBeenCalled();
  });

  it('returns empty array when SpacetimeDB is down', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockHealthCheck.mockResolvedValue(false);

    const request = makeAuthRequest('http://localhost:3000/api/agents');
    const response = await GET(request);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe('POST /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIVY_APP_ID = 'test-app-id';
    process.env.PRIVY_APP_SECRET = 'test-app-secret';
    process.env.TAPESTRY_API_KEY = 'test-tapestry-key';
  });

  it('returns 401 without auth', async () => {
    mockVerifyAuth.mockRejectedValue(new AuthError('Missing Authorization header'));

    const request = new Request('http://localhost:3000/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const response = await POST(request);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(401);
    expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 400 when required fields are missing', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeAuthRequest('http://localhost:3000/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }), // missing valuesProfile, configJson, owner
    });
    const response = await POST(request);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Missing required fields'),
      }),
    );
  });

  it('returns 201 with valid body and creates agent', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockCreatePolicy.mockResolvedValue({ id: 'policy-123' } as never);
    mockCreateAgentWallet.mockResolvedValue({
      id: 'wallet-id-123',
      address: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    } as never);
    mockCreateAgent.mockResolvedValue({
      ok: true,
      energyUsed: 100,
      durationMicros: 5000,
    } as never);
    mockGetOrCreateProfile.mockResolvedValue({
      profile: { id: 'tapestry-profile-1' },
    } as never);

    const request = makeAuthRequest('http://localhost:3000/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'VoteBot',
        valuesProfile: 'Conservative governance approach',
        configJson: { autoVote: true, confidenceThreshold: 0.7 },
        riskTolerance: 'low',
        owner: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      }),
    });
    const response = await POST(request);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(201);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        agentName: 'VoteBot',
        privyWalletAddress: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        privyWalletError: null,
        tapestryProfileId: 'tapestry-profile-1',
        tapestryProfileError: null,
      }),
    );
    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'VoteBot',
        values_profile: 'Conservative governance approach',
        risk_tolerance: 'low',
        owner_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        privy_wallet_id: 'wallet-id-123',
        privy_wallet_address: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      }),
    );
  });

  it('creates agent without Privy wallet when credentials are missing', async () => {
    delete process.env.PRIVY_APP_ID;
    delete process.env.PRIVY_APP_SECRET;
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockCreateAgent.mockResolvedValue({
      ok: true,
      energyUsed: 100,
      durationMicros: 5000,
    } as never);

    const request = makeAuthRequest('http://localhost:3000/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'VoteBot',
        valuesProfile: 'Progressive',
        configJson: { autoVote: false },
        owner: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      }),
    });
    const response = await POST(request);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(201);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        privyWalletAddress: null,
        privyWalletError: expect.stringContaining('Privy credentials not configured'),
      }),
    );
    expect(mockCreatePolicy).not.toHaveBeenCalled();
    expect(mockCreateAgentWallet).not.toHaveBeenCalled();
  });
});
