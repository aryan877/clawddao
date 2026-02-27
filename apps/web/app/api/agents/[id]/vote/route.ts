import { NextRequest, NextResponse } from 'next/server';
import { getAgentById } from '@shared/lib/stdb-client';
import {
  executeAutonomousVote,
  type GovernanceProposalContext,
} from '@shared/lib/autonomous-vote-engine';
import { verifyAuth, AuthError } from '@shared/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await verifyAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const agentId = BigInt(id);
    const agent = await getAgentById(agentId);

    if (!agent) {
      return NextResponse.json(
        { error: `Agent ${id} not found` },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { proposalAddress, proposalTitle, proposalDescription, realmName, realmAddress } = body as {
      proposalAddress: string;
      proposalTitle: string;
      proposalDescription?: string;
      realmName: string;
      realmAddress?: string;
    };

    if (!proposalAddress || !proposalTitle || !realmName) {
      return NextResponse.json(
        { error: 'Missing required fields: proposalAddress, proposalTitle, realmName' },
        { status: 400 },
      );
    }

    const proposal: GovernanceProposalContext = {
      address: proposalAddress,
      title: proposalTitle,
      description: proposalDescription || proposalTitle,
      realmName,
      realmAddress: realmAddress || '',
      forVotes: 0,
      againstVotes: 0,
      status: 'voting',
    };

    const result = await executeAutonomousVote({ agent, proposal });

    return NextResponse.json(result);
  } catch (error) {
    console.error(`POST /api/agents/${id}/vote failed:`, error);
    return NextResponse.json(
      { error: 'Vote execution failed', details: String(error) },
      { status: 500 },
    );
  }
}
