/**
 * setup-devnet-realm.ts
 *
 * Creates a complete SPL Governance test DAO on Solana devnet:
 *   1. Create SPL token mint
 *   2. Create token account + mint tokens
 *   3. Create realm
 *   4. Deposit governing tokens
 *   5. Create governance
 *   6. Create proposal
 *   7. Sign off proposal → moves to Voting state
 *
 * Usage:
 *   npm run setup:devnet-realm -- --airdrop
 *
 * Environment:
 *   SOLANA_PRIVATE_KEY  — base64-encoded keypair (optional, generates fresh if absent)
 *   HELIUS_API_KEY      — uses Helius devnet RPC if set, otherwise public devnet
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import { SplGovernance } from 'governance-idl-sdk';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_DECIMALS = 6;
const MINT_AMOUNT = 1_000_000 * 10 ** TOKEN_DECIMALS; // 1M tokens
const DEPOSIT_AMOUNT = 500_000 * 10 ** TOKEN_DECIMALS; // 500K tokens

// Governance config
const VOTE_THRESHOLD_PERCENTAGE = 60;
const MAX_VOTING_TIME = 3600; // 1 hour

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRpcUrl(): string {
  const heliusKey = process.env.HELIUS_API_KEY;
  if (heliusKey) {
    return `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
  }
  return 'https://api.devnet.solana.com';
}

function getKeypair(): { keypair: Keypair; generated: boolean } {
  const raw = process.env.SOLANA_PRIVATE_KEY;
  if (raw) {
    const decoded = Buffer.from(raw, 'base64');
    return { keypair: Keypair.fromSecretKey(decoded), generated: false };
  }
  console.log('[setup] No SOLANA_PRIVATE_KEY found, generating fresh keypair');
  return { keypair: Keypair.generate(), generated: true };
}

async function airdrop(connection: Connection, pubkey: PublicKey, sol: number): Promise<void> {
  console.log(`[setup] Requesting airdrop of ${sol} SOL to ${pubkey.toBase58()}...`);
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latestBlockhash }, 'confirmed');
  console.log(`[setup] Airdrop confirmed: ${sig}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const shouldAirdrop = process.argv.includes('--airdrop');
  const rpcUrl = getRpcUrl();
  const connection = new Connection(rpcUrl, 'confirmed');
  const { keypair: payer, generated } = getKeypair();

  const gov = new SplGovernance(connection);

  console.log('[setup] RPC:', rpcUrl.replace(/api-key=.*/, 'api-key=***'));
  console.log('[setup] Payer:', payer.publicKey.toBase58());

  // --- Airdrop if requested ---
  if (shouldAirdrop) {
    await airdrop(connection, payer.publicKey, 2);
    await sleep(2000);
    await airdrop(connection, payer.publicKey, 2);
    await sleep(2000);
  }

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`[setup] Payer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    throw new Error('Insufficient balance. Run with --airdrop or fund the wallet.');
  }

  // --- Step 1: Create SPL token mint ---
  console.log('\n[setup] Step 1: Creating SPL token mint...');
  const communityMint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    null, // freeze authority
    TOKEN_DECIMALS,
  );
  console.log(`[setup] Community mint: ${communityMint.toBase58()}`);

  // --- Step 2: Create token account + mint tokens ---
  console.log('\n[setup] Step 2: Creating token account and minting tokens...');
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    communityMint,
    payer.publicKey,
  );
  console.log(`[setup] Token account: ${tokenAccount.address.toBase58()}`);

  await mintTo(
    connection,
    payer,
    communityMint,
    tokenAccount.address,
    payer, // mint authority
    MINT_AMOUNT,
  );
  console.log(`[setup] Minted ${MINT_AMOUNT / 10 ** TOKEN_DECIMALS} tokens`);

  // --- Step 3: Create realm ---
  console.log('\n[setup] Step 3: Creating realm...');
  const realmName = `ClawdDAO-Test-${Date.now()}`;

  const createRealmIx = await gov.createRealmInstruction(
    realmName,
    communityMint,
    1, // minCommunityWeightToCreateGovernance
    payer.publicKey, // realm authority / payer
  );

  const realmPda = gov.pda.realmAccount({ name: realmName });
  const realmAccount = realmPda.publicKey;

  const createRealmTx = new Transaction().add(createRealmIx);
  const realmSig = await sendAndConfirmTransaction(connection, createRealmTx, [payer]);
  console.log(`[setup] Realm created: ${realmAccount.toBase58()} (tx: ${realmSig})`);

  // --- Step 4: Deposit governing tokens ---
  console.log('\n[setup] Step 4: Depositing governing tokens...');
  const depositIx = await gov.depositGoverningTokensInstruction(
    realmAccount,
    communityMint,
    tokenAccount.address, // governing token source account
    payer.publicKey, // governing token owner
    payer.publicKey, // transfer authority
    payer.publicKey, // payer
    DEPOSIT_AMOUNT,
  );

  const tokenOwnerRecordPda = gov.pda.tokenOwnerRecordAccount({
    realmAccount,
    governingTokenMintAccount: communityMint,
    governingTokenOwner: payer.publicKey,
  });
  const tokenOwnerRecord = tokenOwnerRecordPda.publicKey;

  const depositTx = new Transaction().add(depositIx);
  const depositSig = await sendAndConfirmTransaction(connection, depositTx, [payer]);
  console.log(`[setup] Tokens deposited. TOR: ${tokenOwnerRecord.toBase58()} (tx: ${depositSig})`);

  // --- Step 5: Create governance ---
  console.log('\n[setup] Step 5: Creating governance...');
  const governanceSeed = Keypair.generate().publicKey; // random seed for governance PDA

  const createGovIx = await gov.createGovernanceInstruction(
    {
      communityVoteThreshold: { yesVotePercentage: [VOTE_THRESHOLD_PERCENTAGE] },
      minCommunityWeightToCreateProposal: 1,
      minTransactionHoldUpTime: 0,
      votingBaseTime: MAX_VOTING_TIME,
      communityVoteTipping: { early: {} },
      councilVoteThreshold: { disabled: {} },
      councilVetoVoteThreshold: { disabled: {} },
      minCouncilWeightToCreateProposal: 0,
      councilVoteTipping: { disabled: {} },
      communityVetoVoteThreshold: { disabled: {} },
      votingCoolOffTime: 0,
      depositExemptProposalCount: 0,
    },
    realmAccount,
    payer.publicKey, // governance authority
    tokenOwnerRecord,
    payer.publicKey, // payer
    governanceSeed, // governance account seed
  );

  const governancePda = gov.pda.governanceAccount({
    realmAccount,
    seed: governanceSeed,
  });
  const governanceAccount = governancePda.publicKey;

  const govTx = new Transaction().add(createGovIx);
  const govSig = await sendAndConfirmTransaction(connection, govTx, [payer]);
  console.log(`[setup] Governance created: ${governanceAccount.toBase58()} (tx: ${govSig})`);

  // --- Step 6: Create proposal ---
  console.log('\n[setup] Step 6: Creating proposal...');
  const proposalSeed = Keypair.generate().publicKey;

  const createProposalIx = await gov.createProposalInstruction(
    'ClawdDAO Test Proposal — Should we fund AI governance research?',
    'This is a test proposal for the ClawdDAO devnet environment. It tests the full voting flow.',
    { choiceType: 'single', multiChoiceOptions: null }, // VoteType
    ['Approve'], // options
    true, // useDenyOption
    realmAccount,
    governanceAccount,
    tokenOwnerRecord,
    communityMint,
    payer.publicKey, // governance authority
    payer.publicKey, // payer
    proposalSeed,
  );

  const proposalPda = gov.pda.proposalAccount({
    governanceAccount,
    governingTokenMint: communityMint,
    proposalSeed,
  });
  const proposalAccount = proposalPda.publicKey;

  // Fix governance-idl-sdk bug: payer and proposalDepositAccount must be writable
  // but the IDL marks them as isMut: false
  const proposalDepositPda = gov.pda.proposalDepositAccount({
    proposal: proposalAccount,
    depositPayer: payer.publicKey,
  });
  for (const key of createProposalIx.keys) {
    if (key.pubkey.equals(payer.publicKey)) {
      key.isWritable = true;
    }
    if (key.pubkey.equals(proposalDepositPda.publicKey)) {
      key.isWritable = true;
    }
  }

  const proposalTx = new Transaction().add(createProposalIx);
  const proposalSig = await sendAndConfirmTransaction(connection, proposalTx, [payer]);
  console.log(`[setup] Proposal created: ${proposalAccount.toBase58()} (tx: ${proposalSig})`);

  // --- Step 7: Sign off proposal → Voting ---
  console.log('\n[setup] Step 7: Signing off proposal (→ Voting state)...');
  const signOffIx = await gov.signOffProposalInstruction(
    realmAccount,
    governanceAccount,
    proposalAccount,
    payer.publicKey, // signer (proposal owner)
    undefined, // signatory record (owner signs off directly)
    tokenOwnerRecord,
  );

  const signOffTx = new Transaction().add(signOffIx);
  const signOffSig = await sendAndConfirmTransaction(connection, signOffTx, [payer]);
  console.log(`[setup] Proposal signed off (now Voting): tx: ${signOffSig}`);

  // --- Output results ---
  const output = {
    network: 'devnet',
    realmName,
    realmAccount: realmAccount.toBase58(),
    communityMint: communityMint.toBase58(),
    governanceAccount: governanceAccount.toBase58(),
    proposalAccount: proposalAccount.toBase58(),
    tokenOwnerRecord: tokenOwnerRecord.toBase58(),
    payer: payer.publicKey.toBase58(),
  };

  const outputPath = path.resolve(__dirname, 'devnet-realm.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n[setup] Results written to ${outputPath}`);
  console.log(JSON.stringify(output, null, 2));

  if (generated) {
    console.log('\n[setup] IMPORTANT: Save this private key to reuse the payer:');
    console.log(`SOLANA_PRIVATE_KEY=${Buffer.from(payer.secretKey).toString('base64')}`);
  }
}

main().catch((error) => {
  console.error('[setup] Fatal error:', error);
  process.exit(1);
});
