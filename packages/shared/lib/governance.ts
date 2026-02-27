import { Connection, PublicKey } from '@solana/web3.js';
import { SplGovernance } from 'governance-idl-sdk';
import type {
  RealmV2,
  ProposalV2,
  GovernanceAccount,
  TokenOwnerRecord,
  VoteRecord,
} from 'governance-idl-sdk';
import { SOLANA_CHAIN_CONFIG } from './constants';

// ---------------------------------------------------------------------------
// Connection + client singletons (avoid TCP overhead per call)
// ---------------------------------------------------------------------------

let _connection: Connection | null = null;
let _governanceClient: SplGovernance | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(SOLANA_CHAIN_CONFIG.rpcUrl, 'confirmed');
  }
  return _connection;
}

export function getGovernanceClient(): SplGovernance {
  if (!_governanceClient) {
    _governanceClient = new SplGovernance(getConnection());
  }
  return _governanceClient;
}

/** Reset singletons — for test isolation only. */
export function _resetGovernanceSingletons(): void {
  _connection = null;
  _governanceClient = null;
}

// ---------------------------------------------------------------------------
// TTL cache — zero-dependency Map<string, {value, expiresAt}>
// ---------------------------------------------------------------------------

const TTL_REALMS_MS = 5 * 60 * 1000;     // 5 min
const TTL_PROPOSALS_MS = 60 * 1000;       // 60s
const TTL_VOTE_RECORDS_MS = 30 * 1000;    // 30s

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCached<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Clear the governance cache — for tests and manual refresh. */
export function clearGovernanceCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Account field type interfaces
//
// The governance-idl-sdk uses Anchor's IdlAccountsWithPubkey<T> generic which
// flattens all account fields alongside `publicKey`. TypeScript sometimes
// cannot fully resolve the DecodeStruct generic, making direct field access
// fail at the type level even though it works at runtime.
//
// These interfaces describe the expected runtime shape for each account type.
// We use a single `as unknown as X` assertion per serialization function at
// the boundary between the opaque SDK types and our own well-typed code.
// ---------------------------------------------------------------------------

interface BNLike {
  toNumber(): number;
}

interface PublicKeyLike {
  toBase58(): string;
}

interface ProposalV2Fields {
  publicKey: PublicKey;
  state: Record<string, Record<string, never>>;
  options?: Array<{ voteWeight?: BNLike }>;
  denyVoteWeight?: BNLike | null;
  abstainVoteWeight?: BNLike | null;
  draftAt?: BNLike | null;
  startVotingAt?: BNLike | null;
  votingAt?: BNLike | null;
  votingCompletedAt?: BNLike | null;
  maxVotingTime?: BNLike | null;
  governance?: PublicKeyLike | null;
  governingTokenMint?: PublicKeyLike | null;
  tokenOwnerRecord?: PublicKeyLike | null;
  name?: string;
  descriptionLink?: string;
}

interface VoteRecordFields {
  publicKey: PublicKey;
  proposal?: PublicKeyLike | null;
  governingTokenOwner?: PublicKeyLike | null;
  isRelinquished?: boolean;
  voterWeight?: BNLike | null;
  vote?: unknown;
}

interface TokenOwnerRecordFields {
  publicKey: PublicKey;
  governingTokenOwner?: PublicKeyLike | null;
  governingTokenMint?: PublicKeyLike | null;
  governingTokenDepositAmount?: BNLike | null;
  governanceDelegate?: PublicKeyLike | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the human-readable state name from an Anchor-style enum object.
 * The `state` field on ProposalV2 looks like `{ voting: {} }`.
 */
export function getProposalState(state: unknown): string {
  if (state && typeof state === 'object') {
    const keys = Object.keys(state as Record<string, unknown>);
    if (keys.length > 0) return keys[0]!;
  }
  return 'unknown';
}

function bnToNumber(val: BNLike | null | undefined): number | null {
  if (val == null) return null;
  try {
    const n = val.toNumber();
    return n === 0 ? null : n;
  } catch {
    return null;
  }
}

function pubkeyToString(val: PublicKeyLike | null | undefined): string {
  if (val == null) return '';
  try {
    return val.toBase58();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function fetchRealm(realmAddress: string) {
  const cacheKey = `realm:${realmAddress}`;
  const cached = getCached<{ realm: RealmV2; governances: GovernanceAccount[] }>(cacheKey);
  if (cached) return cached;

  const gov = getGovernanceClient();
  const realmPubkey = new PublicKey(realmAddress);

  const [realm, governances] = await Promise.all([
    gov.getRealmByPubkey(realmPubkey),
    gov.getGovernanceAccountsByRealm(realmPubkey),
  ]);

  const result = { realm, governances };
  setCached(cacheKey, result, TTL_REALMS_MS);
  return result;
}

export async function fetchProposalsForRealm(
  realmAddress: string,
  preloadedGovernances?: GovernanceAccount[],
): Promise<ProposalV2[]> {
  const cacheKey = `proposals:${realmAddress}`;
  const cached = getCached<ProposalV2[]>(cacheKey);
  if (cached) return cached;

  const gov = getGovernanceClient();
  const governances =
    preloadedGovernances ??
    (await gov.getGovernanceAccountsByRealm(new PublicKey(realmAddress)));

  // NOTE: Do NOT pass onlyActive to the SDK — its RPC-level filter is unreliable
  // and returns 0 results for devnet proposals. Filter by status client-side instead.
  const proposalArrays = await Promise.all(
    governances.map((g) =>
      gov.getProposalsforGovernance(g.publicKey).catch((err) => {
        console.error(
          `Failed to fetch proposals for governance ${g.publicKey.toBase58()}:`,
          err,
        );
        return [] as ProposalV2[];
      }),
    ),
  );

  const result = proposalArrays.flat();
  setCached(cacheKey, result, TTL_PROPOSALS_MS);
  return result;
}

export async function fetchProposal(proposalAddress: string): Promise<ProposalV2> {
  const gov = getGovernanceClient();
  return gov.getProposalByPubkey(new PublicKey(proposalAddress));
}

export async function fetchVoteRecords(proposalAddress: string): Promise<VoteRecord[]> {
  const cacheKey = `voteRecords:${proposalAddress}`;
  const cached = getCached<VoteRecord[]>(cacheKey);
  if (cached) return cached;

  const gov = getGovernanceClient();
  const result = await gov.getVoteRecordsForProposal(new PublicKey(proposalAddress));
  setCached(cacheKey, result, TTL_VOTE_RECORDS_MS);
  return result;
}

export async function fetchRealmMembers(realmAddress: string): Promise<TokenOwnerRecord[]> {
  const gov = getGovernanceClient();
  return gov.getTokenOwnerRecordsForRealm(new PublicKey(realmAddress));
}

export async function fetchUserTokenRecords(walletAddress: string): Promise<TokenOwnerRecord[]> {
  const gov = getGovernanceClient();
  return gov.getTokenOwnerRecordsForOwner(new PublicKey(walletAddress));
}

// ---------------------------------------------------------------------------
// Serialization (SDK types → plain JSON for the frontend)
// ---------------------------------------------------------------------------

export function serializeRealm(r: RealmV2) {
  return {
    address: r.publicKey.toBase58(),
    name: r.name,
    communityMint: r.communityMint.toBase58(),
    authority: r.authority?.toBase58() ?? null,
  };
}

export function serializeProposal(p: ProposalV2, votingBaseTimeFallback?: number) {
  const fields = p as unknown as ProposalV2Fields;
  const state = getProposalState(fields.state);

  const forVotes = bnToNumber(fields.options?.[0]?.voteWeight) ?? 0;
  const againstVotes = bnToNumber(fields.denyVoteWeight) ?? 0;
  const abstainVotes = bnToNumber(fields.abstainVoteWeight) ?? 0;

  const draftTs = bnToNumber(fields.draftAt);
  const startTs = bnToNumber(fields.startVotingAt);
  const votingAtTs = bnToNumber(fields.votingAt);
  const completedTs = bnToNumber(fields.votingCompletedAt);
  const maxVotingTimeSec = bnToNumber(fields.maxVotingTime) ?? votingBaseTimeFallback ?? null;

  // Compute voting end time: votingAt + votingDuration (both in seconds)
  const votingEndTs =
    votingAtTs && maxVotingTimeSec ? votingAtTs + maxVotingTimeSec : null;

  return {
    address: fields.publicKey.toBase58(),
    governance: pubkeyToString(fields.governance),
    governingTokenMint: pubkeyToString(fields.governingTokenMint),
    tokenOwnerRecord: pubkeyToString(fields.tokenOwnerRecord),
    title: fields.name ?? '',
    descriptionLink: fields.descriptionLink ?? '',
    status: state,
    forVotes,
    againstVotes,
    abstainVotes,
    draftAt: draftTs ? new Date(draftTs * 1000).toISOString() : null,
    startVotingAt: startTs ? new Date(startTs * 1000).toISOString() : null,
    votingAt: votingAtTs ? new Date(votingAtTs * 1000).toISOString() : null,
    votingCompletedAt: completedTs ? new Date(completedTs * 1000).toISOString() : null,
    votingEndAt: votingEndTs ? new Date(votingEndTs * 1000).toISOString() : null,
  };
}

export function serializeGovernance(g: GovernanceAccount) {
  return {
    address: g.publicKey.toBase58(),
  };
}

export function serializeVoteRecord(v: VoteRecord) {
  const fields = v as unknown as VoteRecordFields;
  return {
    address: fields.publicKey.toBase58(),
    proposal: pubkeyToString(fields.proposal),
    governingTokenOwner: pubkeyToString(fields.governingTokenOwner),
    isRelinquished: fields.isRelinquished ?? false,
    voterWeight: bnToNumber(fields.voterWeight) ?? 0,
    vote: fields.vote,
  };
}

export function serializeTokenOwnerRecord(tor: TokenOwnerRecord) {
  const fields = tor as unknown as TokenOwnerRecordFields;
  return {
    address: fields.publicKey.toBase58(),
    governingTokenOwner: pubkeyToString(fields.governingTokenOwner),
    governingTokenMint: pubkeyToString(fields.governingTokenMint),
    governingTokenDepositAmount: bnToNumber(fields.governingTokenDepositAmount) ?? 0,
    governanceDelegate: fields.governanceDelegate ? pubkeyToString(fields.governanceDelegate) : null,
  };
}

export function getProposalDraftTimestamp(p: ProposalV2): number {
  const fields = p as unknown as ProposalV2Fields;
  return bnToNumber(fields.draftAt) ?? 0;
}

// Re-export types for consumers
export type {
  RealmV2,
  ProposalV2,
  GovernanceAccount,
  TokenOwnerRecord,
  VoteRecord,
};
