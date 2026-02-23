import { NextResponse } from 'next/server';
import { getContents } from '@shared/lib/tapestry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tapestry/contents
 *
 * Fetch the latest governance-related content from Tapestry's social graph.
 */
export async function GET() {
  try {
    const contents = await getContents();
    return NextResponse.json(contents, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('GET /api/tapestry/contents failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tapestry contents', details: String(error) },
      { status: 500 },
    );
  }
}
