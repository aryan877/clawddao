import { NextResponse } from 'next/server';
import {
  fetchProposal,
  fetchVoteRecords,
  serializeProposal,
  serializeVoteRecord,
} from '@shared/lib/governance';
import { getVotesByProposal, getAgentsByIds } from '@shared/lib/stdb-client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!address || address.length < 32) {
    return NextResponse.json(
      { error: 'Invalid proposal address' },
      { status: 400 },
    );
  }

  try {
    const [proposal, voteRecords, autonomousVotes] = await Promise.all([
      fetchProposal(address),
      fetchVoteRecords(address),
      getVotesByProposal(address).catch(() => []),
    ]);

    const agentIds = autonomousVotes.map((v) => v.agent_id);
    const agentsMap = await getAgentsByIds(agentIds).catch(() => new Map<bigint, never>());

    const enrichedAutonomousVotes = autonomousVotes.map((vote) => {
      const agent = agentsMap.get(vote.agent_id) ?? null;
      return {
        id: vote.id.toString(),
        agentId: vote.agent_id.toString(),
        agentName: agent?.name ?? `Agent ${vote.agent_id.toString()}`,
        vote: vote.vote,
        reasoning: vote.reasoning,
        confidence: vote.confidence,
        txSignature: vote.tx_signature,
        tapestryContentId: vote.tapestry_content_id,
        createdAt: vote.created_at,
      };
    });

    return NextResponse.json({
      proposal: serializeProposal(proposal),
      votes: voteRecords.map(serializeVoteRecord),
      totalVotes: voteRecords.length,
      autonomousVotes: enrichedAutonomousVotes,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error(`GET /api/governance/proposals/${address} failed:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal', details: String(error) },
      { status: 500 },
    );
  }
}
