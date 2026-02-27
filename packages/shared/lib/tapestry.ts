import { SocialFi } from 'socialfi';
import { TAPESTRY_API_URL } from './constants';

// ---------------------------------------------------------------------------
// Tapestry / SocialFi client
// ---------------------------------------------------------------------------

const socialfi = new SocialFi({ baseURL: TAPESTRY_API_URL });
const apiKey = process.env.TAPESTRY_API_KEY || '';

interface SearchProfileItem {
  profile?: { id?: string };
  walletAddress?: string | null;
  wallet?: { address?: string };
}

interface SearchProfilesResponse {
  profiles?: SearchProfileItem[];
}

function normalizeWalletAddress(walletAddress: string): string {
  return walletAddress.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Profile management
// ---------------------------------------------------------------------------

/**
 * Find an existing profile for the given wallet or create one if it does not
 * exist yet. Uses the Tapestry findOrCreate endpoint.
 */
export async function getOrCreateProfile(walletAddress: string, username: string) {
  try {
    return await socialfi.profiles.findOrCreateCreate(
      { apiKey },
      { walletAddress, username, blockchain: 'SOLANA' },
    );
  } catch (error) {
    console.error('Tapestry getOrCreateProfile failed:', error);
    throw error;
  }
}

/**
 * Retrieve full profile details by profile id.
 */
export async function getProfileDetails(profileId: string) {
  try {
    return await socialfi.profiles.profilesDetail({ apiKey, id: profileId });
  } catch (error) {
    console.error('Tapestry getProfileDetails failed:', error);
    throw error;
  }
}

/**
 * Find a profile using a wallet address.
 * Uses search + deterministic selection to avoid passing wallet addresses into
 * profile-id endpoints.
 */
export async function getProfileByWalletAddress(walletAddress: string) {
  try {
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    const results = await searchProfiles(walletAddress) as SearchProfilesResponse;

    const matches = (results.profiles ?? [])
      .filter((item) => {
        const candidate =
          typeof item.walletAddress === 'string'
            ? item.walletAddress
            : item.wallet?.address;

        return typeof candidate === 'string' && normalizeWalletAddress(candidate) === normalizedWallet;
      })
      .filter((item) => typeof item.profile?.id === 'string')
      .sort((a, b) => (a.profile?.id ?? '').localeCompare(b.profile?.id ?? ''));

    const selectedProfileId = matches[0]?.profile?.id;
    if (!selectedProfileId) {
      return null;
    }

    return await getProfileDetails(selectedProfileId);
  } catch (error) {
    console.error('Tapestry getProfileByWalletAddress failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Content (vote reasoning / governance comments)
// ---------------------------------------------------------------------------

/**
 * Publish a vote reasoning as a content node on the Tapestry social graph.
 *
 * Each vote reasoning is stored as a content item with custom properties
 * that encode the vote direction, reasoning text, confidence, and the
 * on-chain proposal address it relates to.
 */
export async function postVoteReasoning(
  profileId: string,
  proposalAddress: string,
  agentId: string,
  vote: string,
  reasoning: string,
  confidence: number,
) {
  try {
    return await socialfi.contents.findOrCreateCreate(
      { apiKey },
      {
        id: `vote-${proposalAddress}-${agentId}-${Date.now()}`,
        profileId,
        properties: [
          { key: 'type', value: 'vote_reasoning' },
          { key: 'vote', value: vote },
          { key: 'reasoning', value: reasoning },
          { key: 'confidence', value: String(confidence) },
          { key: 'proposalAddress', value: proposalAddress },
          { key: 'agentId', value: agentId },
        ],
      },
    );
  } catch (error) {
    console.error('Tapestry postVoteReasoning failed:', error);
    throw error;
  }
}

/**
 * Get contents list, optionally filtered by a profile id.
 */
export async function getContents(profileId?: string) {
  try {
    return await socialfi.contents.contentsList({
      apiKey,
      ...(profileId ? { profileId } : {}),
    });
  } catch (error) {
    console.error('Tapestry getContents failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

/**
 * Like a content node. `profileId` is the user doing the liking,
 * `contentId` is the Tapestry content node to like.
 */
export async function likeContent(profileId: string, contentId: string) {
  try {
    return await socialfi.likes.likesCreate(
      { apiKey, nodeId: contentId },
      { startId: profileId },
    );
  } catch (error) {
    console.error('Tapestry likeContent failed:', error);
    throw error;
  }
}

/**
 * Remove a like from a content node.
 */
export async function unlikeContent(profileId: string, contentId: string) {
  try {
    return await socialfi.likes.likesDelete(
      { apiKey, nodeId: contentId },
      { startId: profileId },
    );
  } catch (error) {
    console.error('Tapestry unlikeContent failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

/**
 * Get the activity feed for a given username.
 */
export async function getProfileFeed(username: string) {
  try {
    return await socialfi.activity.feedList({ apiKey, username });
  } catch (error) {
    console.error('Tapestry getProfileFeed failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Social graph (following / followers)
// ---------------------------------------------------------------------------

/**
 * Follow a profile. `startId` follows `endId`.
 */
export async function followProfile(startId: string, endId: string) {
  try {
    return await socialfi.followers.postFollowers(
      { apiKey },
      { startId, endId },
    );
  } catch (error) {
    console.error('Tapestry followProfile failed:', error);
    throw error;
  }
}

/**
 * Unfollow a profile.
 */
export async function unfollowProfile(startId: string, endId: string) {
  try {
    return await socialfi.followers.removeCreate(
      { apiKey },
      { startId, endId },
    );
  } catch (error) {
    console.error('Tapestry unfollowProfile failed:', error);
    throw error;
  }
}

/**
 * Check whether startId is following endId.
 */
export async function isFollowing(startId: string, endId: string) {
  try {
    return await socialfi.followers.stateList({ apiKey, startId, endId });
  } catch (error) {
    console.error('Tapestry isFollowing failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search for profiles by query string (username or id).
 */
export async function searchProfiles(query: string) {
  try {
    return await socialfi.search.profilesList({ apiKey, query });
  } catch (error) {
    console.error('Tapestry searchProfiles failed:', error);
    throw error;
  }
}
