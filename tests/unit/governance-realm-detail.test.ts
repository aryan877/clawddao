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

import {
  fetchRealm,
  fetchProposalsForRealm,
  serializeRealm,
  serializeProposal,
  serializeGovernance,
  getProposalDraftTimestamp,
} from '@shared/lib/governance';
import { GET } from '@/app/api/governance/realms/[address]/route';

const mockFetchRealm = vi.mocked(fetchRealm);
const mockFetchProposalsForRealm = vi.mocked(fetchProposalsForRealm);
const mockSerializeRealm = vi.mocked(serializeRealm);
const mockSerializeProposal = vi.mocked(serializeProposal);
const mockSerializeGovernance = vi.mocked(serializeGovernance);
const mockGetProposalDraftTimestamp = vi.mocked(getProposalDraftTimestamp);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_ADDRESS = 'GeXo3Cj6YqYpVucqmAyaL2TPHD1sCGVx1uN9wm1i9GWj';

function callGET(address: string) {
  const request = new Request(`http://localhost:3000/api/governance/realms/${address}`);
  return GET(request, { params: Promise.resolve({ address }) });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/governance/realms/[address]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for an invalid (too short) realm address', async () => {
    const response = await callGET('abc');
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Invalid realm address'),
      }),
    );
  });

  it('returns realm data with governances and proposals on success', async () => {
    const mockRealm = { pubkey: VALID_ADDRESS };
    const mockGovernances = [{ pubkey: 'gov1' }, { pubkey: 'gov2' }];
    mockFetchRealm.mockResolvedValue({
      realm: mockRealm,
      governances: mockGovernances,
    } as never);

    const mockProposals = [
      { pubkey: 'prop1', draftAt: 2000 },
      { pubkey: 'prop2', draftAt: 1000 },
    ];
    mockFetchProposalsForRealm.mockResolvedValue(mockProposals as never);

    mockSerializeRealm.mockReturnValue({
      address: VALID_ADDRESS,
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

    const response = await callGET(VALID_ADDRESS);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        realm: expect.objectContaining({ address: VALID_ADDRESS }),
        governances: expect.arrayContaining([
          expect.objectContaining({ address: 'gov1' }),
          expect.objectContaining({ address: 'gov2' }),
        ]),
        proposals: expect.any(Array),
      }),
    );
    expect(mockFetchRealm).toHaveBeenCalledWith(VALID_ADDRESS);
    expect(mockFetchProposalsForRealm).toHaveBeenCalledWith(VALID_ADDRESS);
  });

  it('returns 500 when fetchRealm throws', async () => {
    mockFetchRealm.mockRejectedValue(new Error('Account not found'));
    mockFetchProposalsForRealm.mockResolvedValue([] as never);

    const response = await callGET(VALID_ADDRESS);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(500);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Failed to fetch realm'),
      }),
    );
  });
});
