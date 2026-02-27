import { NextResponse } from 'next/server';
import {
  fetchRealm,
  fetchProposalsForRealm,
  serializeRealm,
  serializeProposal,
  serializeGovernance,
  getProposalDraftTimestamp,
} from '@shared/lib/governance';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!address || address.length < 32) {
    return NextResponse.json(
      { error: 'Invalid realm address' },
      { status: 400 },
    );
  }

  try {
    const { realm, governances } = await fetchRealm(address);
    const proposals = await fetchProposalsForRealm(address, governances);

    const sorted = [...proposals].sort((a, b) => {
      return getProposalDraftTimestamp(b) - getProposalDraftTimestamp(a);
    });

    return NextResponse.json({
      realm: serializeRealm(realm),
      governances: governances.map(serializeGovernance),
      proposals: sorted.map(serializeProposal),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error(`GET /api/governance/realms/${address} failed:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch realm', details: String(error) },
      { status: 500 },
    );
  }
}
