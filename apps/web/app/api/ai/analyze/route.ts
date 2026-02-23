import { NextRequest, NextResponse } from 'next/server';
import { analyzeProposal } from '@shared/lib/ai';
import { verifyAuth, AuthError } from '@shared/lib/auth';

export const dynamic = 'force-dynamic';

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

    const { title, description, realmName, forVotes, againstVotes } = body as {
      title: string;
      description: string;
      realmName: string;
      forVotes?: number;
      againstVotes?: number;
    };

    if (!title || !description || !realmName) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, realmName' },
        { status: 400 },
      );
    }

    const analysis = await analyzeProposal(
      {
        title,
        description,
        realmName,
        forVotes: forVotes ?? 0,
        againstVotes: againstVotes ?? 0,
      },
    );

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('POST /api/ai/analyze failed:', error);
    return NextResponse.json(
      { error: 'Failed to analyze proposal', details: String(error) },
      { status: 500 },
    );
  }
}
