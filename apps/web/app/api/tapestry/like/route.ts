import { NextResponse } from 'next/server';
import { verifyAuth, AuthError } from '@shared/lib/auth';
import {
  likeContent,
  unlikeContent,
  getOrCreateProfile,
} from '@shared/lib/tapestry';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tapestry/like
 *
 * Toggle a like on a Tapestry content node.
 * Requires Privy auth. Body: { contentId: string, unlike?: boolean }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await verifyAuth(request);

    const body = await request.json();
    const { contentId, unlike } = body as {
      contentId: string;
      unlike?: boolean;
    };

    if (!contentId || typeof contentId !== 'string') {
      return NextResponse.json(
        { error: 'contentId is required' },
        { status: 400 },
      );
    }

    // Get or create the user's Tapestry profile
    const profile = await getOrCreateProfile(userId, userId) as unknown as
      { profile?: { id?: string } };
    const profileId = profile?.profile?.id ?? userId;

    if (unlike) {
      await unlikeContent(profileId, contentId);
    } else {
      await likeContent(profileId, contentId);
    }

    return NextResponse.json({ success: true, liked: !unlike });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error('POST /api/tapestry/like failed:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 },
    );
  }
}
