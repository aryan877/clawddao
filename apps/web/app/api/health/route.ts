import { NextResponse } from 'next/server';
import { healthCheck } from '@shared/lib/stdb-client';
import { getConnection } from '@shared/lib/governance';
import { isConfigured as privyConfigured } from '@shared/lib/privy-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs: number }> = {};

  const stdbStart = Date.now();
  const stdbOk = await healthCheck();
  checks.spacetimedb = { ok: stdbOk, latencyMs: Date.now() - stdbStart };

  const rpcStart = Date.now();
  let rpcOk = false;
  try {
    const conn = getConnection();
    const slot = await conn.getSlot();
    rpcOk = slot > 0;
  } catch {
    rpcOk = false;
  }
  checks.solanaRpc = { ok: rpcOk, latencyMs: Date.now() - rpcStart };

  checks.zai = {
    ok: !!process.env.ZAI_API_KEY,
    latencyMs: 0,
  };

  checks.tapestry = {
    ok: !!process.env.TAPESTRY_API_KEY,
    latencyMs: 0,
  };

  checks.privy = {
    ok: privyConfigured(),
    latencyMs: 0,
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks },
    { status: allOk ? 200 : 503 },
  );
}
