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

export function getConnection(): Connection {
  return new Connection(SOLANA_CHAIN_CONFIG.rpcUrl, 'confirmed');
}

export function getGovernanceClient(): SplGovernance {
  return new SplGovernance(getConnection());
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
  votingCompletedAt?: BNLike | null;
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
  const gov = getGovernanceClient();
  const realmPubkey = new PublicKey(realmAddress);

  const [realm, governances] = await Promise.all([
    gov.getRealmByPubkey(realmPubkey),
    gov.getGovernanceAccountsByRealm(realmPubkey),
  ]);

  return { realm, governances };
}

export async function fetchProposalsForRealm(realmAddress: string): Promise<ProposalV2[]> {
  const gov = getGovernanceClient();
  const realmPubkey = new PublicKey(realmAddress);
  const governances = await gov.getGovernanceAccountsByRealm(realmPubkey);

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

  return proposalArrays.flat();
}

export async function fetchProposal(proposalAddress: string): Promise<ProposalV2> {
  const gov = getGovernanceClient();
  return gov.getProposalByPubkey(new PublicKey(proposalAddress));
}

export async function fetchVoteRecords(proposalAddress: string): Promise<VoteRecord[]> {
  const gov = getGovernanceClient();
  return gov.getVoteRecordsForProposal(new PublicKey(proposalAddress));
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

export function serializeProposal(p: ProposalV2) {
  const fields = p as unknown as ProposalV2Fields;
  const state = getProposalState(fields.state);

  const forVotes = bnToNumber(fields.options?.[0]?.voteWeight) ?? 0;
  const againstVotes = bnToNumber(fields.denyVoteWeight) ?? 0;
  const abstainVotes = bnToNumber(fields.abstainVoteWeight) ?? 0;

  const draftTs = bnToNumber(fields.draftAt);
  const startTs = bnToNumber(fields.startVotingAt);
  const completedTs = bnToNumber(fields.votingCompletedAt);

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
    votingCompletedAt: completedTs ? new Date(completedTs * 1000).toISOString() : null,
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
