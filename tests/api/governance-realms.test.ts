import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '../helpers';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@shared/lib/governance', () => ({
  fetchRealm: vi.fn(),
  fetchProposalsForRealm: vi.fn(),
  serializeRealm: vi.fn(),
  serializeProposal: vi.fn(),
  serializeGovernance: vi.fn(),
  getProposalDraftTimestamp: vi.fn(),
}));

vi.mock('@shared/lib/stdb-client', () => ({
  getTrackedRealms: vi.fn(),
}));

import {
  fetchRealm,
  fetchProposalsForRealm,
  serializeRealm,
  serializeProposal,
  serializeGovernance,
  getProposalDraftTimestamp,
} from '@shared/lib/governance';
import { getTrackedRealms } from '@shared/lib/stdb-client';
import { GET } from '@/app/api/governance/realms/route';

const mockFetchRealm = vi.mocked(fetchRealm);
const mockFetchProposalsForRealm = vi.mocked(fetchProposalsForRealm);
const mockSerializeRealm = vi.mocked(serializeRealm);
const mockSerializeProposal = vi.mocked(serializeProposal);
const mockSerializeGovernance = vi.mocked(serializeGovernance);
const mockGetProposalDraftTimestamp = vi.mocked(getProposalDraftTimestamp);
const mockGetTrackedRealms = vi.mocked(getTrackedRealms);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/governance/realms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no tracked realms exist', async () => {
    mockGetTrackedRealms.mockResolvedValue([]);

    const response = await GET();
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns realms with proposals and governances on success', async () => {
    const trackedRealms = [
      { address: 'realm111111111111111111111111111111111111111', name: 'TestDAO' },
    ];
    mockGetTrackedRealms.mockResolvedValue(trackedRealms as never);

    const mockRealm = { pubkey: 'realm111' };
    const mockGovernances = [{ pubkey: 'gov1' }];
    mockFetchRealm.mockResolvedValue({
      realm: mockRealm,
      governances: mockGovernances,
    } as never);

    const mockProposals = [
      { pubkey: 'prop1', draftAt: 1000 },
      { pubkey: 'prop2', draftAt: 2000 },
    ];
    mockFetchProposalsForRealm.mockResolvedValue(mockProposals as never);

    mockSerializeRealm.mockReturnValue({
      address: 'realm111',
      name: 'TestDAO',
    } as never);
    mockSerializeGovernance.mockImplementation(
      (gov) => ({ address: (gov as Record<string, unknown>).pubkey }) as never,
    );
    mockSerializeProposal.mockImplementation(
      (prop) => ({ address: (prop as Record<string, unknown>).pubkey }) as never,
    );
    mockGetProposalDraftTimestamp.mockImplementation(
      (prop) => (prop as Record<string, unknown>).draftAt as number,
    );

    const response = await GET();
    const { status, body } = await parseResponse<unknown[]>(response);

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual(
      expect.objectContaining({
        address: 'realm111',
        displayName: 'TestDAO',
        governanceCount: 1,
      }),
    );
  });

  it('handles partial failures gracefully (filters out rejected realms)', async () => {
    const trackedRealms = [
      { address: 'realm1', name: 'GoodDAO' },
      { address: 'realm2', name: 'BrokenDAO' },
    ];
    mockGetTrackedRealms.mockResolvedValue(trackedRealms as never);

    // First realm succeeds
    mockFetchRealm.mockImplementation(async (address) => {
      if (address === 'realm1') {
        return { realm: { pubkey: 'realm1' }, governances: [] } as never;
      }
      throw new Error('RPC timeout');
    });
    mockFetchProposalsForRealm.mockImplementation(async (address) => {
      if (address === 'realm1') return [] as never;
      throw new Error('RPC timeout');
    });

    mockSerializeRealm.mockReturnValue({ address: 'realm1', name: 'GoodDAO' } as never);

    const response = await GET();
    const { status, body } = await parseResponse<unknown[]>(response);

    expect(status).toBe(200);
    // Only the successful realm should be in the result
    expect(body).toHaveLength(1);
  });

  it('returns 500 when getTrackedRealms throws', async () => {
    mockGetTrackedRealms.mockRejectedValue(new Error('DB connection failed'));

    const response = await GET();
    const { status, body } = await parseResponse(response);

    expect(status).toBe(500);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Failed to fetch realms'),
      }),
    );
  });
});
