import { NextResponse } from 'next/server';
import {
  getAllActiveAgents,
  getAgentsByOwner,
  createAgent,
  healthCheck,
} from '@shared/lib/stdb-client';
import * as privy from '@shared/lib/privy-client';
import { getOrCreateProfile } from '@shared/lib/tapestry';
import { SOLANA_CHAIN_CONFIG } from '@shared/lib/constants';
import { verifyAuth, AuthError } from '@shared/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents?wallet=<address>
 *
 * Returns agents. If `wallet` query param is provided, returns only agents
 * owned by that wallet. Otherwise returns all active agents.
 * Data is read from SpacetimeDB via SQL query.
 */
export async function GET(request: Request) {
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

  const isUp = await healthCheck();
  if (!isUp) {
    // SpacetimeDB not running — return empty array gracefully
    // This allows the frontend to still render without a backend
    return NextResponse.json([]);
  }

  try {
    const agents = wallet
      ? await getAgentsByOwner(wallet)
      : await getAllActiveAgents();

    return NextResponse.json(agents);
  } catch (error) {
    console.error('GET /api/agents failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents', details: String(error) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/agents
 *
 * Create a new AI agent. Calls the `create_agent` reducer in SpacetimeDB
 * which atomically inserts the agent record.
 */
export async function POST(request: Request) {
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

    const { name, valuesProfile, configJson, riskTolerance, owner } = body as {
      name: string;
      valuesProfile: string;
      configJson: Record<string, unknown>;
      riskTolerance: string;
      owner: string;
    };

    if (!name || !valuesProfile || !configJson || !owner) {
      return NextResponse.json(
        { error: 'Missing required fields: name, valuesProfile, configJson, owner' },
        { status: 400 },
      );
    }

    // ─── Create Privy wallet for agent (REQUIRED for on-chain voting) ───
    // If Privy is not configured, agent is created but cannot vote on-chain
    let privyWalletId: string | undefined;
    let privyWalletAddress: string | undefined;
    let privyWalletError: string | undefined;

    const privyAppId = process.env.PRIVY_APP_ID;
    const privyAppSecret = process.env.PRIVY_APP_SECRET;

    if (!privyAppId || !privyAppSecret) {
      privyWalletError = 'Privy credentials not configured — agent cannot vote on-chain';
      console.warn(
        `⚠️ ${privyWalletError}\nConfigure PRIVY_APP_ID and PRIVY_APP_SECRET to enable agent voting.`,
      );
    } else {
      try {
        // Create spending policy (max 0.1 SOL per tx)
        const policy = await privy.createPolicy({
          maxSolPerTx: 0.1,
          chainId: SOLANA_CHAIN_CONFIG.chainId,
        });

        // Create wallet with policy
        const wallet = await privy.createAgentWallet({
          policyIds: [policy.id],
          label: `Agent: ${name}`,
        });

        privyWalletId = wallet.id;
        privyWalletAddress = wallet.address;
        console.log(`✅ Created Privy wallet for agent "${name}": ${wallet.address}`);
      } catch (privyError) {
        privyWalletError = `Privy wallet creation failed: ${String(privyError)}`;
        console.error(`❌ ${privyWalletError}`);
      }
    }

    // ─── Create agent in SpacetimeDB ───
    const result = await createAgent({
      name,
      values_profile: valuesProfile,
      config_json: JSON.stringify(configJson),
      risk_tolerance: riskTolerance || 'moderate',
      owner_wallet: owner,
      privy_wallet_id: privyWalletId,
      privy_wallet_address: privyWalletAddress,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: 'SpacetimeDB reducer failed', details: result.error },
        { status: 500 },
      );
    }

    let tapestryProfileId: string | null = null;
    let tapestryProfileError: string | null = null;

    if (privyWalletAddress && process.env.TAPESTRY_API_KEY) {
      try {
        const profile = await getOrCreateProfile(privyWalletAddress, name);
        tapestryProfileId = profile?.profile?.id ?? null;
      } catch (tapestryError) {
        tapestryProfileError = `Tapestry profile setup failed: ${String(tapestryError)}`;
        console.error(`⚠️ ${tapestryProfileError}`);
      }
    }

    return NextResponse.json(
      {
        success: true,
        agentName: name,
        privyWalletAddress: privyWalletAddress || null,
        privyWalletError: privyWalletError || null,
        tapestryProfileId,
        tapestryProfileError,
        energyUsed: result.energyUsed,
        durationMicros: result.durationMicros,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/agents failed:', error);
    return NextResponse.json(
      { error: 'Failed to create agent', details: String(error) },
      { status: 500 },
    );
  }
}
