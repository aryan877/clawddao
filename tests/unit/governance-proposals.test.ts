import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '../helpers';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@shared/lib/governance', () => ({
  fetchProposal: vi.fn(),
  fetchVoteRecords: vi.fn(),
  serializeProposal: vi.fn(),
  serializeVoteRecord: vi.fn(),
}));

vi.mock('@shared/lib/stdb-client', () => ({
  getVotesByProposal: vi.fn(),
  getAgentsByIds: vi.fn(),
}));

import {
  fetchProposal,
  fetchVoteRecords,
  serializeProposal,
  serializeVoteRecord,
} from '@shared/lib/governance';
import { getVotesByProposal, getAgentsByIds } from '@shared/lib/stdb-client';
import { GET } from '@/app/api/governance/proposals/[address]/route';

const mockFetchProposal = vi.mocked(fetchProposal);
const mockFetchVoteRecords = vi.mocked(fetchVoteRecords);
const mockSerializeProposal = vi.mocked(serializeProposal);
const mockSerializeVoteRecord = vi.mocked(serializeVoteRecord);
const mockGetVotesByProposal = vi.mocked(getVotesByProposal);
const mockGetAgentsByIds = vi.mocked(getAgentsByIds);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_PROPOSAL_ADDRESS = '3D2FStH92TpCPTWooFK4H66ibDmdMka427cA8RsmrjZ2';

function callGET(address: string) {
  const request = new Request(
    `http://localhost:3000/api/governance/proposals/${address}`,
  );
  return GET(request, { params: Promise.resolve({ address }) });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/governance/proposals/[address]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for an invalid (too short) proposal address', async () => {
    const response = await callGET('short');
    const { status, body } = await parseResponse(response);

    expect(status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Invalid proposal address'),
      }),
    );
  });

  it('returns proposal with on-chain votes and enriched autonomous votes on success', async () => {
    const rawProposal = { pubkey: VALID_PROPOSAL_ADDRESS, title: 'Fund Grants' };
    mockFetchProposal.mockResolvedValue(rawProposal as never);

    const onChainVotes = [
      { pubkey: 'vote1', voter: 'walletA' },
      { pubkey: 'vote2', voter: 'walletB' },
    ];
    mockFetchVoteRecords.mockResolvedValue(onChainVotes as never);

    const autonomousVotes = [
      {
        id: BigInt(1),
        agent_id: BigInt(10),
        vote: 'FOR',
        reasoning: 'Good proposal',
        confidence: 0.9,
        tx_signature: 'sig1',
        tapestry_content_id: 'content1',
        created_at: '2026-02-01T00:00:00Z',
      },
    ];
    mockGetVotesByProposal.mockResolvedValue(autonomousVotes as never);

    const agent = { name: 'VoteBot', id: BigInt(10) };
    mockGetAgentsByIds.mockResolvedValue(new Map([[BigInt(10), agent]]) as never);

    mockSerializeProposal.mockReturnValue({
      address: VALID_PROPOSAL_ADDRESS,
      title: 'Fund Grants',
    } as never);
    mockSerializeVoteRecord.mockImplementation(
      (vote) => ({ voter: (vote as Record<string, unknown>).voter }) as never,
    );

    const response = await callGET(VALID_PROPOSAL_ADDRESS);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        proposal: expect.objectContaining({
          address: VALID_PROPOSAL_ADDRESS,
          title: 'Fund Grants',
        }),
        votes: expect.arrayContaining([
          expect.objectContaining({ voter: 'walletA' }),
          expect.objectContaining({ voter: 'walletB' }),
        ]),
        totalVotes: 2,
        autonomousVotes: expect.arrayContaining([
          expect.objectContaining({
            agentId: '10',
            agentName: 'VoteBot',
            vote: 'FOR',
            reasoning: 'Good proposal',
            confidence: 0.9,
            txSignature: 'sig1',
          }),
        ]),
      }),
    );
  });

  it('handles autonomous votes gracefully when STDB query fails', async () => {
    mockFetchProposal.mockResolvedValue({ pubkey: VALID_PROPOSAL_ADDRESS } as never);
    mockFetchVoteRecords.mockResolvedValue([] as never);
    mockGetVotesByProposal.mockRejectedValue(new Error('STDB unreachable'));

    mockSerializeProposal.mockReturnValue({
      address: VALID_PROPOSAL_ADDRESS,
    } as never);

    const response = await callGET(VALID_PROPOSAL_ADDRESS);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        autonomousVotes: [],
        totalVotes: 0,
      }),
    );
  });

  it('falls back to generic agent name when getAgentById fails', async () => {
    mockFetchProposal.mockResolvedValue({ pubkey: VALID_PROPOSAL_ADDRESS } as never);
    mockFetchVoteRecords.mockResolvedValue([] as never);

    const autonomousVotes = [
      {
        id: BigInt(1),
        agent_id: BigInt(42),
        vote: 'AGAINST',
        reasoning: 'Too risky',
        confidence: 0.6,
        tx_signature: null,
        tapestry_content_id: null,
        created_at: '2026-02-01T00:00:00Z',
      },
    ];
    mockGetVotesByProposal.mockResolvedValue(autonomousVotes as never);
    mockGetAgentsByIds.mockRejectedValue(new Error('Agent not found'));

    mockSerializeProposal.mockReturnValue({
      address: VALID_PROPOSAL_ADDRESS,
    } as never);

    const response = await callGET(VALID_PROPOSAL_ADDRESS);
    const { status, body } = await parseResponse<{
      autonomousVotes: Array<{ agentName: string }>;
    }>(response);

    expect(status).toBe(200);
    expect(body.autonomousVotes[0].agentName).toBe('Agent 42');
  });

  it('returns 500 when fetchProposal throws', async () => {
    mockFetchProposal.mockRejectedValue(new Error('Proposal not found'));
    mockFetchVoteRecords.mockResolvedValue([] as never);
    mockGetVotesByProposal.mockResolvedValue([] as never);

    const response = await callGET(VALID_PROPOSAL_ADDRESS);
    const { status, body } = await parseResponse(response);

    expect(status).toBe(500);
    expect(body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Failed to fetch proposal'),
      }),
    );
  });
});
