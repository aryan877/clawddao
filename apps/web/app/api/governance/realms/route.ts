import { NextResponse } from 'next/server';
import {
  fetchRealm,
  fetchProposalsForRealm,
  serializeRealm,
  serializeProposal,
  serializeGovernance,
  getProposalDraftTimestamp,
} from '@shared/lib/governance';
import { getTrackedRealms } from '@shared/lib/stdb-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const trackedRealms = await getTrackedRealms();

    if (trackedRealms.length === 0) {
      return NextResponse.json([]);
    }

    const results = await Promise.allSettled(
      trackedRealms.map(async (entry) => {
        const [{ realm, governances }, proposals] = await Promise.all([
          fetchRealm(entry.address),
          fetchProposalsForRealm(entry.address),
        ]);

        const sorted = [...proposals].sort(
          (a, b) => getProposalDraftTimestamp(b) - getProposalDraftTimestamp(a),
        );

        return {
          ...serializeRealm(realm),
          displayName: entry.name,
          governanceCount: governances.length,
          governances: governances.map(serializeGovernance),
          proposals: sorted.map(serializeProposal),
        };
      }),
    );

    type RealmResult = ReturnType<typeof serializeRealm> & {
      displayName: string;
      governanceCount: number;
      governances: ReturnType<typeof serializeGovernance>[];
      proposals: ReturnType<typeof serializeProposal>[];
    };

    const realms = results
      .filter(
        (r): r is PromiseFulfilledResult<RealmResult> => r.status === 'fulfilled',
      )
      .map((r) => r.value);

    return NextResponse.json(realms);
  } catch (error) {
    console.error('GET /api/governance/realms failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch realms', details: String(error) },
      { status: 500 },
    );
  }
}
