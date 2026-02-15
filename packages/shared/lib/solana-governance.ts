/**
 * Solana Governance Transaction Builders
 *
 * Builds real SPL Governance instructions using governance-idl-sdk.
 * Transactions are returned unsigned — either:
 *   - Serialized base64 for Privy to sign (agent voting)
 *   - Serialized base64 for frontend wallet adapter (user delegation)
 *
 * No custom contracts needed — SPL Governance is already deployed on Solana.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { SplGovernance } from 'governance-idl-sdk';
import { getConnection, getGovernanceClient } from './governance';

// Re-export the Vote type from the IDL (Anchor enum format)
// Vote variants: { approve: [[{ rank: 0, weightPercentage: 100 }]] } | { deny: {} } | { abstain: {} } | { veto: {} }
type Vote = Parameters<SplGovernance['castVoteInstruction']>[0];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a simple vote string to the SPL Governance Vote type.
 */
export function toVoteType(vote: string): Vote {
  switch (vote.toLowerCase()) {
    case 'for':
    case 'approve':
    case 'yes':
      return { approve: [[{ rank: 0, weightPercentage: 100 }]] } as Vote;
    case 'against':
    case 'deny':
    case 'no':
      return { deny: {} } as Vote;
    case 'abstain':
      return { abstain: {} } as Vote;
    case 'veto':
      return { veto: {} } as Vote;
    default:
      throw new Error(`Unknown vote type: "${vote}". Expected: for, against, abstain, veto`);
  }
}

/**
 * Serialize an unsigned Transaction to base64 for wallet signing.
 */
async function serializeUnsigned(
  tx: Transaction,
  connection: Connection,
  feePayer: PublicKey,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = feePayer;

  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return Buffer.from(serialized).toString('base64');
}

/**
 * Add priority fee instructions for reliable landing.
 */
function addPriorityFee(tx: Transaction): void {
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
  );
}

// ---------------------------------------------------------------------------
// Proposal lookup helpers
// ---------------------------------------------------------------------------

interface ProposalInfo {
  realmAddress: PublicKey;
  governanceAddress: PublicKey;
  governingTokenMint: PublicKey;
  proposalOwnerTokenOwnerRecord: PublicKey;
}

/**
 * Fetch the on-chain proposal to extract required account addresses
 * for building vote instructions.
 */
export async function getProposalInfo(proposalAddress: string): Promise<ProposalInfo> {
  const gov = getGovernanceClient();
  const proposalPubkey = new PublicKey(proposalAddress);
  const proposal = await gov.getProposalByPubkey(proposalPubkey);

  // The proposal account contains references to its parent governance and realm.
  // governance-idl-sdk uses Anchor's decoded format.
  const p = proposal as unknown as {
    publicKey: PublicKey;
    governance: PublicKey;
    governingTokenMint: PublicKey;
    tokenOwnerRecord: PublicKey;
    realm: PublicKey;
  };

  if (!p.governance || !p.governingTokenMint || !p.tokenOwnerRecord || !p.realm) {
    throw new Error(
      `Proposal ${proposalAddress} is missing required fields. ` +
      `Got governance=${p.governance}, mint=${p.governingTokenMint}, ` +
      `TOR=${p.tokenOwnerRecord}, realm=${p.realm}`,
    );
  }

  return {
    realmAddress: p.realm,
    governanceAddress: p.governance,
    governingTokenMint: p.governingTokenMint,
    proposalOwnerTokenOwnerRecord: p.tokenOwnerRecord,
  };
}

// ---------------------------------------------------------------------------
// CastVote Transaction Builder
// ---------------------------------------------------------------------------

/**
 * Build a CastVote transaction for an agent to vote on a proposal.
 *
 * The transaction is unsigned — Privy will sign it with the agent's wallet.
 *
 * @returns base64-serialized unsigned transaction
 */
export async function buildCastVoteTransaction(params: {
  /** The proposal to vote on */
  proposalAddress: string;
  /** The agent's Privy wallet address (voter + fee payer) */
  voterWalletAddress: string;
  /** The vote direction: 'for' | 'against' | 'abstain' | 'veto' */
  voteDirection: string;
}): Promise<{
  serializedTransaction: string;
  proposalInfo: ProposalInfo;
}> {
  const connection = getConnection();
  const gov = getGovernanceClient();

  const proposalPubkey = new PublicKey(params.proposalAddress);
  const voterPubkey = new PublicKey(params.voterWalletAddress);

  // Fetch proposal to get governance, realm, mint, etc.
  const info = await getProposalInfo(params.proposalAddress);

  // Derive the voter's TokenOwnerRecord PDA
  const voterTokenOwnerRecord = gov.pda.tokenOwnerRecordAccount({
    realmAccount: info.realmAddress,
    governingTokenMintAccount: info.governingTokenMint,
    governingTokenOwner: voterPubkey,
  }).publicKey;

  // Build the vote
  const vote = toVoteType(params.voteDirection);

  // Build the CastVote instruction
  const castVoteIx = await gov.castVoteInstruction(
    vote,
    info.realmAddress,
    info.governanceAddress,
    proposalPubkey,
    info.proposalOwnerTokenOwnerRecord,
    voterTokenOwnerRecord,
    voterPubkey,           // governanceAuthority (signer = the agent wallet)
    info.governingTokenMint,
    voterPubkey,           // payer
  );

  // Build transaction with priority fees
  const tx = new Transaction();
  addPriorityFee(tx);
  tx.add(castVoteIx);

  // Serialize unsigned
  const serializedTransaction = await serializeUnsigned(tx, connection, voterPubkey);

  return { serializedTransaction, proposalInfo: info };
}

// ---------------------------------------------------------------------------
// SetGovernanceDelegate Transaction Builder
// ---------------------------------------------------------------------------

/**
 * Build a SetGovernanceDelegate transaction for a user to delegate
 * their voting power to an agent's wallet.
 *
 * The USER signs this transaction (not Privy), because it's the user
 * who is delegating their own governance tokens.
 *
 * @returns base64-serialized unsigned transaction for frontend wallet to sign
 */
export async function buildDelegateTransaction(params: {
  /** The realm (DAO) address */
  realmAddress: string;
  /** The governing token mint (community or council) */
  governingTokenMintAddress: string;
  /** The user's wallet address (the delegator — must sign) */
  delegatorWalletAddress: string;
  /** The agent's Privy wallet address (the delegate receiving voting power) */
  delegateWalletAddress: string;
}): Promise<string> {
  const connection = getConnection();
  const gov = getGovernanceClient();

  const realm = new PublicKey(params.realmAddress);
  const governingTokenMint = new PublicKey(params.governingTokenMintAddress);
  const delegator = new PublicKey(params.delegatorWalletAddress);
  const delegate = new PublicKey(params.delegateWalletAddress);

  // Derive the delegator's TokenOwnerRecord PDA
  const tokenOwnerRecord = gov.pda.tokenOwnerRecordAccount({
    realmAccount: realm,
    governingTokenMintAccount: governingTokenMint,
    governingTokenOwner: delegator,
  }).publicKey;

  // Build SetGovernanceDelegate instruction
  const ix = await gov.setGovernanceDelegateInstruction(
    tokenOwnerRecord,
    delegator,     // currentDelegateOrOwner (signer)
    delegate,      // newGovernanceDelegate
  );

  const tx = new Transaction();
  addPriorityFee(tx);
  tx.add(ix);

  return serializeUnsigned(tx, connection, delegator);
}

/**
 * Build a transaction to revoke delegation (set delegate to null).
 *
 * @returns base64-serialized unsigned transaction for frontend wallet to sign
 */
export async function buildRevokeDelegationTransaction(params: {
  realmAddress: string;
  governingTokenMintAddress: string;
  delegatorWalletAddress: string;
}): Promise<string> {
  const connection = getConnection();
  const gov = getGovernanceClient();

  const realm = new PublicKey(params.realmAddress);
  const governingTokenMint = new PublicKey(params.governingTokenMintAddress);
  const delegator = new PublicKey(params.delegatorWalletAddress);

  const tokenOwnerRecord = gov.pda.tokenOwnerRecordAccount({
    realmAccount: realm,
    governingTokenMintAccount: governingTokenMint,
    governingTokenOwner: delegator,
  }).publicKey;

  // Pass null to revoke delegation
  const ix = await gov.setGovernanceDelegateInstruction(
    tokenOwnerRecord,
    delegator,
    null,
  );

  const tx = new Transaction();
  addPriorityFee(tx);
  tx.add(ix);

  return serializeUnsigned(tx, connection, delegator);
}

// ---------------------------------------------------------------------------
// Transaction submission + confirmation
// ---------------------------------------------------------------------------

/**
 * Submit a signed transaction and wait for confirmation.
 *
 * @param signedTransactionBase64 - The fully-signed transaction as base64
 * @returns Transaction signature
 */
export async function submitAndConfirm(signedTransactionBase64: string): Promise<{
  signature: string;
  confirmed: boolean;
}> {
  const connection = getConnection();
  const txBuffer = Buffer.from(signedTransactionBase64, 'base64');

  // Simulate first
  const { VersionedTransaction } = await import('@solana/web3.js');
  const parsedTx = VersionedTransaction.deserialize(txBuffer);

  const simulation = await connection.simulateTransaction(parsedTx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });

  if (simulation.value.err) {
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}` +
      (simulation.value.logs ? `\nLogs: ${simulation.value.logs.join('\n')}` : ''),
    );
  }

  // Submit
  const signature = await connection.sendRawTransaction(txBuffer, {
    skipPreflight: true,
    maxRetries: 3,
    preflightCommitment: 'processed',
  });

  // Poll for confirmation (up to 30 seconds)
  let confirmed = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });

    if (status.value) {
      if (status.value.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.value.err)}`);
      }
      if (
        status.value.confirmationStatus === 'confirmed' ||
        status.value.confirmationStatus === 'finalized'
      ) {
        confirmed = true;
        break;
      }
    }
  }

  return { signature, confirmed };
}
