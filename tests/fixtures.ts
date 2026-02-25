export const VALID_AUTH_TOKEN = 'valid-test-token-abc123';
export const VALID_USER_ID = 'did:privy:test-user-123';

export function makeAuthHeaders(token = VALID_AUTH_TOKEN): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function makeAuthRequest(
  url: string,
  init?: RequestInit,
  token = VALID_AUTH_TOKEN,
): Request {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return new Request(url, { ...init, headers });
}

export function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    name: 'Test Agent',
    values_profile: 'Conservative governance',
    config_json: JSON.stringify({
      autoVote: true,
      confidenceThreshold: 0.7,
      values: ['transparency', 'security'],
      focusAreas: ['treasury'],
    }),
    risk_tolerance: 'moderate',
    owner_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    privy_wallet_id: 'wallet-id-123',
    privy_wallet_address: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    is_active: true,
    total_votes: 5,
    accuracy_score: 0.85,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeProposal(overrides: Record<string, unknown> = {}) {
  return {
    address: 'proposal111111111111111111111111111111111111',
    title: 'Test Proposal: Fund dev grants',
    description: 'Allocate 10K SOL to developer grants program.',
    realmName: 'TestDAO',
    forVotes: 1000,
    againstVotes: 200,
    abstainVotes: 50,
    status: 'voting',
    ...overrides,
  };
}

export function makeDelegation(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    delegator_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    agent_id: BigInt(1),
    realm_address: 'realm1111111111111111111111111111111111111111',
    scope_bitmap: BigInt(1),
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
