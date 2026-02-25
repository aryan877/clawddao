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
  generateAgentConfig: vi.fn(),
}));

import { verifyAuth, AuthError } from '@shared/lib/auth';
import { generateAgentConfig } from '@shared/lib/ai';
import { POST } from '@/app/api/ai/agent-config/route';

const mockVerifyAuth = vi.mocked(verifyAuth);
const mockGenerateAgentConfig = vi.mocked(generateAgentConfig);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfigRequest(body: unknown, authenticated = true) {
  if (authenticated) {
    return makeAuthRequest('http://localhost:3000/api/ai/agent-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  return new Request('http://localhost:3000/api/ai/agent-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/ai/agent-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    mockVerifyAuth.mockRejectedValue(new AuthError('Missing Authorization header'));

    const request = makeConfigRequest({ values: 'Conservative' }, false);
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(401);
    expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 400 when values is missing', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeConfigRequest({});
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({ error: expect.stringContaining('values') }),
    );
  });

  it('returns 400 when values is an empty string', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeConfigRequest({ values: '   ' });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({ error: expect.stringContaining('values') }),
    );
  });

  it('returns 400 when values is not a string', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeConfigRequest({ values: 123 });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({ error: expect.stringContaining('values') }),
    );
  });

  it('returns config object on success', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const generatedConfig = {
      values: ['transparency', 'security', 'decentralization'],
      riskTolerance: 'moderate',
      autoVote: true,
      confidenceThreshold: 0.75,
      focusAreas: ['treasury', 'governance'],
    };
    mockGenerateAgentConfig.mockResolvedValue(generatedConfig as never);

    const request = makeConfigRequest({
      values: 'I value transparency and security in governance decisions',
    });
    const response = await POST(request as never);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(generatedConfig);
    expect(mockGenerateAgentConfig).toHaveBeenCalledWith(
      'I value transparency and security in governance decisions',
    );
  });
});
