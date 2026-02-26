/**
 * SpacetimeDB HTTP Client
 *
 * REST API to call reducers and run SQL queries.
 * Frontend real-time uses WebSocket subscriptions instead.
 */

const STDB_URL = process.env.SPACETIMEDB_URL || 'http://localhost:3000';
const STDB_DB = process.env.SPACETIMEDB_MODULE_NAME || 'clawddao';

let cachedToken: string | null = null;
let cachedIdentity: string | null = null;

/**
 * Obtain a SpacetimeDB identity + JWT token.
 * Tokens are cached for the lifetime of the process.
 */
async function getIdentityToken(): Promise<{ identity: string; token: string }> {
  if (cachedToken && cachedIdentity) {
    return { identity: cachedIdentity, token: cachedToken };
  }

  const res = await fetch(`${STDB_URL}/v1/identity`, { method: 'POST' });

  if (!res.ok) {
    throw new Error(`SpacetimeDB identity request failed: ${res.status} ${res.statusText}`);
  }

  // SpacetimeDB v2 returns identity/token in body (v1 used headers)
  const body = await res.json() as { identity?: string; token?: string };
  const identity = body.identity ?? res.headers.get('spacetime-identity');
  const token = body.token ?? res.headers.get('spacetime-identity-token');

  if (!identity || !token) {
    throw new Error('SpacetimeDB did not return identity/token');
  }

  cachedIdentity = identity;
  cachedToken = token;

  return { identity, token };
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function toVoteKey(agentId: bigint, proposalAddress: string): string {
  return `${agentId.toString()}:${proposalAddress}`;
}

/**
 * Call a SpacetimeDB reducer with the given arguments.
 *
 * @param reducer - The reducer name (e.g., 'create_agent')
 * @param args - Array of arguments matching the reducer's parameter types
 * @returns The response headers with execution metadata
 */
export async function callReducer(
  reducer: string,
  args: unknown[],
): Promise<{
  ok: boolean;
  energyUsed?: string;
  durationMicros?: string;
  error?: string;
}> {
  const { token } = await getIdentityToken();

  const res = await fetch(`${STDB_URL}/v1/database/${STDB_DB}/call/${reducer}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  const result = {
    ok: res.ok,
    energyUsed: res.headers.get('spacetime-energy-used') ?? undefined,
    durationMicros: res.headers.get('spacetime-execution-duration-micros') ?? undefined,
    error: undefined as string | undefined,
  };

  if (!res.ok) {
    result.error = await res.text();
  }

  return result;
}

/**
 * Run a SQL query against SpacetimeDB.
 *
 * @param sql - The SQL query string (can include multiple statements separated by `;`)
 * @returns Array of statement results, each with schema and rows
 */
export async function querySQL<T = Record<string, unknown>>(
  sql: string,
): Promise<T[]> {
  const { token } = await getIdentityToken();

  const res = await fetch(`${STDB_URL}/v1/database/${STDB_DB}/sql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: sql,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SpacetimeDB SQL query failed: ${res.status} — ${errText}`);
  }

  const results: Array<{
    schema: unknown;
    rows: unknown[][];
  }> = await res.json();

  if (results.length === 0) return [];

  const firstResult = results[0];
  if (!firstResult || !firstResult.rows) return [];

  const schema = firstResult.schema as {
    elements?: Array<{ name?: string | { some: string }; algebraic_type?: unknown }>;
  };

  // SpacetimeDB v2 wraps column names in { some: "name" } instead of plain strings
  const columnNames = schema.elements?.map((e) => {
    if (typeof e.name === 'string') return e.name;
    if (e.name && typeof e.name === 'object' && 'some' in e.name) return e.name.some;
    return '';
  }) ?? [];

  return firstResult.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columnNames.length; i++) {
      obj[columnNames[i]] = row[i];
    }
    return obj as T;
  });
}

// ---------------------------------------------------------------------------
// Typed reducer wrappers — one per reducer defined in the SpacetimeDB module
// ---------------------------------------------------------------------------

export async function createAgent(params: {
  name: string;
  values_profile: string;
  config_json: string;
  risk_tolerance: string;
  owner_wallet: string;
  privy_wallet_id?: string;
  privy_wallet_address?: string;
}) {
  return callReducer('create_agent', [
    params.name,
    params.values_profile,
    params.config_json,
    params.risk_tolerance,
    params.owner_wallet,
    params.privy_wallet_id ?? null,
    params.privy_wallet_address ?? null,
  ]);
}

export async function updateAgent(params: {
  agent_id: bigint;
  name?: string;
  config_json?: string;
  is_active?: boolean;
}) {
  return callReducer('update_agent', [
    params.agent_id,
    params.name ?? null,
    params.config_json ?? null,
    params.is_active ?? null,
  ]);
}

export async function recordVote(params: {
  agent_id: bigint;
  proposal_address: string;
  vote: string;
  reasoning: string;
  confidence: number;
  tx_signature?: string | null;
  tapestry_content_id?: string | null;
}) {
  return callReducer('record_vote', [
    params.agent_id,
    params.proposal_address,
    params.vote,
    params.reasoning,
    params.confidence,
    params.tx_signature ?? null,
    params.tapestry_content_id ?? null,
  ]);
}

export async function createDelegation(params: {
  agent_id: bigint;
  realm_address: string;
  scope_bitmap: bigint;
  delegator_wallet: string;
}) {
  return callReducer('create_delegation', [
    params.agent_id,
    params.realm_address,
    params.scope_bitmap,
    params.delegator_wallet,
  ]);
}

export async function revokeDelegation(delegationId: bigint) {
  return callReducer('revoke_delegation', [delegationId]);
}

export async function addTrackedRealm(params: {
  address: string;
  name: string;
}) {
  return callReducer('add_tracked_realm', [params.address, params.name]);
}

export async function removeTrackedRealm(address: string) {
  return callReducer('remove_tracked_realm', [address]);
}

export async function seedTrackedRealms() {
  return callReducer('seed_tracked_realms', []);
}

export async function storeAIAnalysis(params: {
  agent_id: bigint;
  proposal_address: string;
  analysis_json: string;
  recommendation: string;
  confidence: number;
}) {
  return callReducer('store_ai_analysis', [
    params.agent_id,
    params.proposal_address,
    params.analysis_json,
    params.recommendation,
    params.confidence,
  ]);
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface AgentRow {
  id: bigint;
  owner_wallet: string;
  name: string;
  values_profile: string;
  config_json: string;
  risk_tolerance: string;
  is_active: boolean;
  privy_wallet_id: string | null;
  privy_wallet_address: string | null;
  total_votes: number;
  accuracy_score: number;
  delegation_count: number;
  created_at: number;
  updated_at: number;
}

export interface VoteRow {
  id: bigint;
  vote_key: string;
  agent_id: bigint;
  proposal_address: string;
  vote: string;
  reasoning: string;
  confidence: number;
  tx_signature: string | null;
  tapestry_content_id: string | null;
  created_at: number;
}

export interface AIAnalysisRow {
  id: bigint;
  analysis_key: string;
  agent_id: bigint;
  proposal_address: string;
  analysis_json: string;
  recommendation: string;
  confidence: number;
  created_at: number;
}

export interface DelegationRow {
  id: bigint;
  delegator_wallet: string;
  agent_id: bigint;
  realm_address: string;
  scope_bitmap: bigint;
  is_active: boolean;
  on_chain_pda: string | null;
  created_at: number;
}

export interface ActivityRow {
  id: bigint;
  agent_id: bigint;
  action_type: string;
  description: string;
  metadata_json: string | null;
  created_at: number;
}

export interface TrackedRealmRow {
  id: bigint;
  address: string;
  name: string;
  is_active: boolean;
  added_at: number;
}

export async function getTrackedRealms(): Promise<TrackedRealmRow[]> {
  return querySQL<TrackedRealmRow>(
    'SELECT * FROM tracked_realms WHERE is_active = true',
  );
}

export async function getAgentsByOwner(walletAddress: string): Promise<AgentRow[]> {
  const safeWallet = escapeSqlString(walletAddress);
  return querySQL<AgentRow>(
    `SELECT * FROM agents WHERE owner_wallet = '${safeWallet}' AND is_active = true`,
  );
}

export async function getAgentById(agentId: bigint): Promise<AgentRow | null> {
  const rows = await querySQL<AgentRow>(
    `SELECT * FROM agents WHERE id = ${agentId.toString()}`,
  );
  return rows[0] ?? null;
}

export async function getAllActiveAgents(): Promise<AgentRow[]> {
  const rows = await querySQL<AgentRow>(
    'SELECT * FROM agents WHERE is_active = true',
  );
  // SpacetimeDB has no ORDER BY — sort by total_votes descending client-side
  return rows.sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0));
}

export async function getVotesByAgent(agentId: bigint): Promise<VoteRow[]> {
  const rows = await querySQL<VoteRow>(
    `SELECT * FROM votes WHERE agent_id = ${agentId.toString()}`,
  );
  // Sort newest first by created_at
  return rows.sort((a, b) => Number(b.created_at ?? 0) - Number(a.created_at ?? 0));
}

export async function getVotesByProposal(proposalAddress: string): Promise<VoteRow[]> {
  const safeProposal = escapeSqlString(proposalAddress);
  const rows = await querySQL<VoteRow>(
    `SELECT * FROM votes WHERE proposal_address = '${safeProposal}'`,
  );
  return rows.sort((a, b) => Number(b.created_at ?? 0) - Number(a.created_at ?? 0));
}

export async function getVoteByAgentAndProposal(
  agentId: bigint,
  proposalAddress: string,
): Promise<VoteRow | null> {
  const safeVoteKey = escapeSqlString(toVoteKey(agentId, proposalAddress));
  const rows = await querySQL<VoteRow>(
    `SELECT * FROM votes WHERE vote_key = '${safeVoteKey}' LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function hasAgentVoted(agentId: bigint, proposalAddress: string): Promise<boolean> {
  const existing = await getVoteByAgentAndProposal(agentId, proposalAddress);
  return Boolean(existing);
}

export async function getAIAnalysisByAgentAndProposal(
  agentId: bigint,
  proposalAddress: string,
): Promise<AIAnalysisRow | null> {
  const safeAnalysisKey = escapeSqlString(toVoteKey(agentId, proposalAddress));
  const rows = await querySQL<AIAnalysisRow>(
    `SELECT * FROM ai_analyses WHERE analysis_key = '${safeAnalysisKey}' LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function getDelegationsByAgent(agentId: bigint): Promise<DelegationRow[]> {
  return querySQL<DelegationRow>(
    `SELECT * FROM delegations WHERE agent_id = ${agentId.toString()} AND is_active = true`,
  );
}

export async function getDelegationsByWallet(wallet: string): Promise<DelegationRow[]> {
  const safeWallet = escapeSqlString(wallet);
  return querySQL<DelegationRow>(
    `SELECT * FROM delegations WHERE delegator_wallet = '${safeWallet}' AND is_active = true`,
  );
}

export async function getActivityLog(agentId: bigint, limit = 50): Promise<ActivityRow[]> {
  const rows = await querySQL<ActivityRow>(
    `SELECT * FROM activity_log WHERE agent_id = ${agentId.toString()} LIMIT ${limit}`,
  );
  // Sort newest first
  return rows.sort((a, b) => Number(b.created_at ?? 0) - Number(a.created_at ?? 0));
}

/**
 * Check if SpacetimeDB is reachable.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${STDB_URL}/v1/ping`);
    return res.ok;
  } catch {
    return false;
  }
}
