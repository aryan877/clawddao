import { NextRequest, NextResponse } from 'next/server';
import {
  createDelegation,
  getAgentById,
  getDelegationsByWallet,
} from '@shared/lib/stdb-client';
import { AGENT_PERMISSIONS } from '@shared/lib/constants';
import { verifyAuth, AuthError } from '@shared/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json(
      { error: 'Missing required query param: wallet' },
      { status: 400 },
    );
  }

  try {
    const delegations = await getDelegationsByWallet(wallet);
    return NextResponse.json(delegations);
  } catch (error) {
    console.error('GET /api/delegations failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delegations', details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { agentId, realmAddress, delegatorWallet, scopeBitmap } = body as {
      agentId: string;
      realmAddress: string;
      delegatorWallet: string;
      scopeBitmap?: number;
    };

    if (!agentId || !realmAddress || !delegatorWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, realmAddress, delegatorWallet' },
        { status: 400 },
      );
    }

    const agent = await getAgentById(BigInt(agentId));
    if (!agent) {
      return NextResponse.json(
        { error: `Agent ${agentId} not found` },
        { status: 404 },
      );
    }

    const result = await createDelegation({
      agent_id: BigInt(agentId),
      realm_address: realmAddress,
      delegator_wallet: delegatorWallet,
      scope_bitmap: BigInt(scopeBitmap ?? AGENT_PERMISSIONS.VOTE),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Delegation creation failed', details: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('POST /api/delegations failed:', error);
    return NextResponse.json(
      { error: 'Failed to create delegation', details: String(error) },
      { status: 500 },
    );
  }
}
