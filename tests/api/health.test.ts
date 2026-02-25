import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseResponse } from '../helpers';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@shared/lib/stdb-client', () => ({
  healthCheck: vi.fn(),
}));

vi.mock('@shared/lib/governance', () => ({
  getConnection: vi.fn(),
}));

vi.mock('@shared/lib/privy-client', () => ({
  isConfigured: vi.fn(),
}));

import { healthCheck } from '@shared/lib/stdb-client';
import { getConnection } from '@shared/lib/governance';
import { isConfigured } from '@shared/lib/privy-client';
import { GET } from '@/app/api/health/route';

const mockHealthCheck = vi.mocked(healthCheck);
const mockGetConnection = vi.mocked(getConnection);
const mockIsConfigured = vi.mocked(isConfigured);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.TAPESTRY_API_KEY = 'test-key';
  });

  it('returns 200 with healthy status when all services are up', async () => {
    mockHealthCheck.mockResolvedValue(true);
    mockGetConnection.mockReturnValue({
      getSlot: vi.fn().mockResolvedValue(12345),
    } as unknown as ReturnType<typeof getConnection>);
    mockIsConfigured.mockReturnValue(true);

    const request = createRequest('/api/health');
    const response = await GET();
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        status: 'healthy',
        checks: expect.objectContaining({
          spacetimedb: expect.objectContaining({ ok: true }),
          solanaRpc: expect.objectContaining({ ok: true }),
          anthropic: expect.objectContaining({ ok: true }),
          tapestry: expect.objectContaining({ ok: true }),
          privy: expect.objectContaining({ ok: true }),
        }),
      }),
    );
  });

  it('returns 503 with degraded status when SpacetimeDB is down', async () => {
    mockHealthCheck.mockResolvedValue(false);
    mockGetConnection.mockReturnValue({
      getSlot: vi.fn().mockResolvedValue(12345),
    } as unknown as ReturnType<typeof getConnection>);
    mockIsConfigured.mockReturnValue(true);

    const response = await GET();
    const { status, body } = await parseResponse(response);

    expect(status).toBe(503);
    expect(body).toEqual(
      expect.objectContaining({
        status: 'degraded',
        checks: expect.objectContaining({
          spacetimedb: expect.objectContaining({ ok: false }),
        }),
      }),
    );
  });

  it('returns 503 with degraded status when Solana RPC fails', async () => {
    mockHealthCheck.mockResolvedValue(true);
    mockGetConnection.mockReturnValue({
      getSlot: vi.fn().mockRejectedValue(new Error('RPC unreachable')),
    } as unknown as ReturnType<typeof getConnection>);
    mockIsConfigured.mockReturnValue(true);

    const response = await GET();
    const { status, body } = await parseResponse(response);

    expect(status).toBe(503);
    expect(body).toEqual(
      expect.objectContaining({
        status: 'degraded',
        checks: expect.objectContaining({
          solanaRpc: expect.objectContaining({ ok: false }),
        }),
      }),
    );
  });

  it('returns degraded when Privy is not configured', async () => {
    mockHealthCheck.mockResolvedValue(true);
    mockGetConnection.mockReturnValue({
      getSlot: vi.fn().mockResolvedValue(100),
    } as unknown as ReturnType<typeof getConnection>);
    mockIsConfigured.mockReturnValue(false);

    const response = await GET();
    const { status, body } = await parseResponse(response);

    expect(status).toBe(503);
    expect(body).toEqual(
      expect.objectContaining({
        status: 'degraded',
        checks: expect.objectContaining({
          privy: expect.objectContaining({ ok: false }),
        }),
      }),
    );
  });

  it('returns degraded when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    mockHealthCheck.mockResolvedValue(true);
    mockGetConnection.mockReturnValue({
      getSlot: vi.fn().mockResolvedValue(100),
    } as unknown as ReturnType<typeof getConnection>);
    mockIsConfigured.mockReturnValue(true);

    const response = await GET();
    const { status, body } = await parseResponse(response);

    expect(status).toBe(503);
    expect(body).toEqual(
      expect.objectContaining({
        status: 'degraded',
        checks: expect.objectContaining({
          anthropic: expect.objectContaining({ ok: false }),
        }),
      }),
    );
  });

  it('includes latencyMs for each check', async () => {
    mockHealthCheck.mockResolvedValue(true);
    mockGetConnection.mockReturnValue({
      getSlot: vi.fn().mockResolvedValue(100),
    } as unknown as ReturnType<typeof getConnection>);
    mockIsConfigured.mockReturnValue(true);

    const response = await GET();
    const { body } = await parseResponse<{
      checks: Record<string, { ok: boolean; latencyMs: number }>;
    }>(response);

    for (const check of Object.values(body.checks)) {
      expect(check).toHaveProperty('latencyMs');
      expect(typeof check.latencyMs).toBe('number');
    }
  });
});
