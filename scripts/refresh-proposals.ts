/**
 * refresh-proposals.ts
 *
 * Sets up delegation for agent voting:
 * 1. Finalizes expired proposals
 * 2. Creates delegator wallets (one per agent), deposits governance tokens, delegates to agents
 * 3. Updates agent config_json in STDB with delegatorAddress
 * 4. Creates fresh proposals
 * 5. Runs the worker cycle
 *
 * Usage: DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/refresh-proposals.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { SplGovernance } from 'governance-idl-sdk';
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import { getAllActiveAgents, updateAgent } from '@shared/lib/stdb-client';

const REALM_FILE = path.resolve(__dirname, 'devnet-realm.json');
const TOKEN_DECIMALS = 6;
const TOKENS_PER_DELEGATOR = 10_000 * 10 ** TOKEN_DECIMALS; // 10K tokens each

interface RealmConfig {
  realmAccount: string;
  communityMint: string;
  governanceAccount: string;
  tokenOwnerRecord: string;
}

function loadRealmConfig(): RealmConfig {
  return JSON.parse(fs.readFileSync(REALM_FILE, 'utf-8'));
}

function getConnection(): Connection {
  const heliusKey = process.env.HELIUS_API_KEY;
  const rpcUrl = heliusKey
    ? `https://devnet.helius-rpc.com/?api-key=${heliusKey}`
    : 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

function getPayer(): Keypair {
  const raw = process.env.SOLANA_PRIVATE_KEY;
  if (!raw) throw new Error('SOLANA_PRIVATE_KEY not set');
  return Keypair.fromSecretKey(Buffer.from(raw, 'base64'));
}

const PROPOSALS = [
  {
    title: 'Allocate 50K SOL to DeFi Protocol Insurance Fund',
    description:
      'Proposal to establish a community insurance fund using 50,000 SOL from the treasury. The fund would cover users affected by smart contract exploits in approved DeFi integrations. A 3-of-5 multisig of elected community members would manage payouts.',
  },
  {
    title: 'Migrate Governance to veToken Model',
    description:
      'Transition from 1-token-1-vote to a vote-escrow model where users lock tokens for 1-52 weeks. Longer locks yield higher voting power (up to 4x). This aligns long-term holders with governance outcomes and reduces mercenary voting.',
  },
  {
    title: 'Fund Developer Grants Program — Season 2',
    description:
      'Continue the developer grants program with a 25,000 SOL budget for Season 2. Focus areas: SDK tooling, analytics dashboards, and mobile wallet integrations. Applications reviewed by a 5-member committee with monthly cohorts.',
  },
  {
    title: 'Reduce Proposal Quorum from 10% to 5%',
    description:
      'Current 10% quorum requirement has caused 40% of proposals to fail due to voter apathy, not opposition. Reducing to 5% would improve governance participation while still requiring meaningful engagement. Emergency proposals would retain 10% quorum.',
  },
];

async function main() {
  const config = loadRealmConfig();
  const connection = getConnection();
  const payer = getPayer();
  const gov = new SplGovernance(connection);

  const realmPk = new PublicKey(config.realmAccount);
  const governancePk = new PublicKey(config.governanceAccount);
  const communityMint = new PublicKey(config.communityMint);
  const tokenOwnerRecord = new PublicKey(config.tokenOwnerRecord);

  // -------------------------------------------------------------------------
  // Step 1: Finalize expired proposals
  // -------------------------------------------------------------------------
  console.log('=== Step 1: Finalizing expired proposals ===\n');
  const proposals = await gov.getProposalsforGovernance(governancePk);
  console.log(`Found ${proposals.length} proposals`);

  for (const p of proposals) {
    const state = Object.keys(p.state ?? {})[0];
    if (state !== 'voting') continue;

    try {
      const ix = await gov.finalizeVoteInstruction(
        realmPk, governancePk, p.publicKey, tokenOwnerRecord, communityMint,
      );
      const tx = new Transaction().add(ix);
      await sendAndConfirmTransaction(connection, tx, [payer]);
      console.log(`  Finalized: ${p.publicKey.toBase58()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('CannotFinalizeVotingInProgress')) {
        console.log(`  Still active: ${p.publicKey.toBase58()}`);
      } else {
        console.log(`  Skip: ${p.publicKey.toBase58()}: ${msg.slice(0, 80)}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Create delegator wallets, deposit tokens, delegate to agents
  // -------------------------------------------------------------------------
  console.log('\n=== Step 2: Setting up delegation for agents ===\n');
  const agents = await getAllActiveAgents();

  for (const agent of agents) {
    if (!agent.privy_wallet_address) continue;

    // Check if agent already has a delegatorAddress in config
    let existingConfig: Record<string, unknown> = {};
    try {
      existingConfig = JSON.parse(agent.config_json) as Record<string, unknown>;
    } catch { /* ignore */ }

    if (existingConfig.delegatorAddress) {
      // Verify the TOR exists
      const delegatorPk = new PublicKey(existingConfig.delegatorAddress as string);
      const torPda = gov.pda.tokenOwnerRecordAccount({
        realmAccount: realmPk,
        governingTokenMintAccount: communityMint,
        governingTokenOwner: delegatorPk,
      });
      const torAccount = await connection.getAccountInfo(torPda.publicKey);
      if (torAccount) {
        console.log(`  ${agent.name}: Already has delegator ${(existingConfig.delegatorAddress as string).slice(0, 8)}...`);
        continue;
      }
    }

    console.log(`  ${agent.name}: Creating delegator wallet...`);

    // Create a temp keypair to serve as the delegator
    const delegator = Keypair.generate();

    // Fund delegator with a tiny SOL amount for rent
    const fundTx = new Transaction().add(
      require('@solana/web3.js').SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: delegator.publicKey,
        lamports: 5_000_000, // 0.005 SOL for rent
      }),
    );
    await sendAndConfirmTransaction(connection, fundTx, [payer]);

    // Create ATA for delegator and mint governance tokens
    const delegatorAta = await getOrCreateAssociatedTokenAccount(
      connection, payer, communityMint, delegator.publicKey,
    );

    // Payer is mint authority — mint tokens directly to delegator's ATA
    await mintTo(
      connection, payer, communityMint, delegatorAta.address,
      payer, // mint authority
      TOKENS_PER_DELEGATOR,
    );
    console.log(`    Minted ${TOKENS_PER_DELEGATOR / 10 ** TOKEN_DECIMALS} tokens to delegator`);

    // Deposit governance tokens (delegator signs as both owner and transfer authority)
    const depositIx = await gov.depositGoverningTokensInstruction(
      realmPk,
      communityMint,
      delegatorAta.address,   // source token account
      delegator.publicKey,    // governing token owner (same as transfer authority → no extra signer needed)
      delegator.publicKey,    // transfer authority
      payer.publicKey,        // payer for PDA creation
      TOKENS_PER_DELEGATOR,
    );
    const depositTx = new Transaction().add(depositIx);
    await sendAndConfirmTransaction(connection, depositTx, [payer, delegator]);

    // Get the delegator's TOR
    const delegatorTor = gov.pda.tokenOwnerRecordAccount({
      realmAccount: realmPk,
      governingTokenMintAccount: communityMint,
      governingTokenOwner: delegator.publicKey,
    }).publicKey;
    console.log(`    TOR: ${delegatorTor.toBase58()}`);

    // Delegate voting power to the agent's Privy wallet
    const agentPk = new PublicKey(agent.privy_wallet_address);
    const delegateIx = await gov.setGovernanceDelegateInstruction(
      delegatorTor,
      delegator.publicKey,  // current owner (signer)
      agentPk,              // new delegate = agent
    );
    const delegateTx = new Transaction().add(delegateIx);
    await sendAndConfirmTransaction(connection, delegateTx, [payer, delegator]);
    console.log(`    Delegated to agent: ${agent.privy_wallet_address.slice(0, 8)}...`);

    // Update agent's config_json in STDB with delegatorAddress
    const updatedConfig = {
      ...existingConfig,
      delegatorAddress: delegator.publicKey.toBase58(),
    };
    await updateAgent({
      agent_id: agent.id,
      config_json: JSON.stringify(updatedConfig),
    });
    console.log(`    ✓ Updated STDB config with delegatorAddress`);
  }

  // -------------------------------------------------------------------------
  // Step 3: Create fresh proposals
  // -------------------------------------------------------------------------
  console.log('\n=== Step 3: Creating fresh proposals ===\n');
  const newProposals: string[] = [];

  for (const [i, prop] of PROPOSALS.entries()) {
    console.log(`[${i + 1}/${PROPOSALS.length}] Creating: "${prop.title}"`);
    try {
      const proposalSeed = Keypair.generate().publicKey;

      const createIx = await gov.createProposalInstruction(
        prop.title,
        prop.description,
        { choiceType: 'single', multiChoiceOptions: null },
        ['Approve'],
        true,
        realmPk,
        governancePk,
        tokenOwnerRecord,
        communityMint,
        payer.publicKey,
        payer.publicKey,
        proposalSeed,
      );

      const proposalPda = gov.pda.proposalAccount({
        governanceAccount: governancePk,
        governingTokenMint: communityMint,
        proposalSeed,
      });
      const proposalPk = proposalPda.publicKey;

      // Fix governance-idl-sdk bug: payer + deposit must be writable
      const proposalDepositPda = gov.pda.proposalDepositAccount({
        proposal: proposalPk,
        depositPayer: payer.publicKey,
      });
      for (const key of createIx.keys) {
        if (key.pubkey.equals(payer.publicKey)) key.isWritable = true;
        if (key.pubkey.equals(proposalDepositPda.publicKey)) key.isWritable = true;
      }

      const createTx = new Transaction().add(createIx);
      await sendAndConfirmTransaction(connection, createTx, [payer]);

      // Sign off → Voting
      const signOffIx = await gov.signOffProposalInstruction(
        realmPk, governancePk, proposalPk,
        payer.publicKey, undefined, tokenOwnerRecord,
      );
      const signOffTx = new Transaction().add(signOffIx);
      await sendAndConfirmTransaction(connection, signOffTx, [payer]);

      console.log(`   ✓ ${proposalPk.toBase58()} (Voting)`);
      newProposals.push(proposalPk.toBase58());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Too many outstanding proposals')) {
        console.log(`   ⚠ Max outstanding proposals reached.`);
        break;
      }
      console.error(`   ✗ Failed: ${msg.slice(0, 150)}`);
    }
  }

  console.log(`\nCreated ${newProposals.length} new proposals`);
  if (newProposals.length === 0) {
    console.log('\nNo proposals created. Exiting.');
    return;
  }

  // -------------------------------------------------------------------------
  // Step 4: Run worker cycle
  // -------------------------------------------------------------------------
  console.log('\n=== Step 4: Running worker cycle ===\n');
  const { runWorkerCycle } = await import('../apps/worker/run-cycle');
  const summary = await runWorkerCycle({ dryRun: false, maxConcurrency: 1 });

  console.log('\n--- Worker Cycle Summary ---');
  console.log(`  Agents scanned:    ${summary.agentsScanned}`);
  console.log(`  Agents eligible:   ${summary.agentsEligible}`);
  console.log(`  Active proposals:  ${summary.activeProposals}`);
  console.log(`  Combinations:      ${summary.combinationsConsidered}`);
  console.log(`  Executed:          ${summary.executed}`);
  console.log(`  Skipped:           ${summary.skipped}`);
  console.log(`  Failed:            ${summary.failed}`);
}

main().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
