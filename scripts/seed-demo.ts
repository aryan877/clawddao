/**
 * seed-demo.ts
 *
 * Seeds the ClawdDAO devnet environment with realistic activity:
 *   1. Creates 4 additional proposals on the existing devnet realm
 *   2. Creates 3 AI agents with real Privy wallets
 *   3. Registers the realm as tracked (idempotent)
 *   4. Triggers a single worker cycle so agents analyze + vote + post to Tapestry
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts
 *
 * Requires:
 *   SOLANA_PRIVATE_KEY, HELIUS_API_KEY, PRIVY_APP_ID, PRIVY_APP_SECRET,
 *   ZAI_API_KEY, TAPESTRY_API_KEY in .env.local
 */

// Env is preloaded via: DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config
// This ensures process.env is populated before any module-level reads.

import * as path from 'path';
import * as fs from 'fs';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { SplGovernance } from 'governance-idl-sdk';
import { createPolicy, createAgentWallet } from '@shared/lib/privy-client';
import {
  createAgent,
  addTrackedRealm,
  getTrackedRealms,
  getAllActiveAgents,
} from '@shared/lib/stdb-client';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REALM_FILE = path.resolve(__dirname, 'devnet-realm.json');

interface RealmConfig {
  network: string;
  realmName: string;
  realmAccount: string;
  communityMint: string;
  governanceAccount: string;
  proposalAccount: string;
  tokenOwnerRecord: string;
  payer: string;
}

function loadRealmConfig(): RealmConfig {
  if (!fs.existsSync(REALM_FILE)) {
    throw new Error(`Realm config not found at ${REALM_FILE}. Run setup-devnet-realm first.`);
  }
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

// ---------------------------------------------------------------------------
// Proposal definitions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

const AGENTS = [
  {
    name: 'DeFi Maximalist',
    values_profile: 'Prioritize DeFi growth, protocol revenue, and sustainable yield. Favor proposals that grow TVL and establish competitive moats.',
    risk_tolerance: 'aggressive',
    config: {
      autoVote: true,
      confidenceThreshold: 0.55,
      values: ['DeFi growth', 'protocol revenue', 'competitive moats', 'yield sustainability'],
      focusAreas: ['treasury management', 'DeFi integrations', 'tokenomics'],
    },
  },
  {
    name: 'Governance Purist',
    values_profile: 'Decentralization above all. Resist treasury centralization, favor broad participation, and demand transparent processes.',
    risk_tolerance: 'conservative',
    config: {
      autoVote: true,
      confidenceThreshold: 0.70,
      values: ['decentralization', 'transparency', 'broad participation', 'accountability'],
      focusAreas: ['governance structure', 'voting mechanisms', 'community processes'],
    },
  },
  {
    name: 'Builder Advocate',
    values_profile: 'Support developers and builders. Fund grants, improve tooling, lower barriers to contribution. The ecosystem wins when builders ship.',
    risk_tolerance: 'moderate',
    config: {
      autoVote: true,
      confidenceThreshold: 0.60,
      values: ['developer experience', 'ecosystem growth', 'open source', 'innovation'],
      focusAreas: ['developer grants', 'tooling', 'documentation', 'hackathons'],
    },
  },
];

// ---------------------------------------------------------------------------
// Step 1: Create proposals on devnet
// ---------------------------------------------------------------------------

async function createProposals(
  connection: Connection,
  payer: Keypair,
  realmConfig: RealmConfig,
): Promise<string[]> {
  console.log('\n=== Step 1: Creating proposals on devnet ===\n');

  const gov = new SplGovernance(connection);
  const realmAccount = new PublicKey(realmConfig.realmAccount);
  const governanceAccount = new PublicKey(realmConfig.governanceAccount);
  const communityMint = new PublicKey(realmConfig.communityMint);
  const tokenOwnerRecord = new PublicKey(realmConfig.tokenOwnerRecord);

  const proposalAddresses: string[] = [];

  for (const [i, prop] of PROPOSALS.entries()) {
    console.log(`[${i + 1}/${PROPOSALS.length}] Creating: "${prop.title}"`);

    try {
      const proposalSeed = Keypair.generate().publicKey;

      const createProposalIx = await gov.createProposalInstruction(
        prop.title,
        prop.description,
        { choiceType: 'single', multiChoiceOptions: null },
        ['Approve'],
        true, // useDenyOption
        realmAccount,
        governanceAccount,
        tokenOwnerRecord,
        communityMint,
        payer.publicKey,
        payer.publicKey,
        proposalSeed,
      );

      const proposalPda = gov.pda.proposalAccount({
        governanceAccount,
        governingTokenMint: communityMint,
        proposalSeed,
      });
      const proposalAccount = proposalPda.publicKey;

      // Fix governance-idl-sdk bug: payer + deposit account must be writable
      const proposalDepositPda = gov.pda.proposalDepositAccount({
        proposal: proposalAccount,
        depositPayer: payer.publicKey,
      });
      for (const key of createProposalIx.keys) {
        if (key.pubkey.equals(payer.publicKey)) key.isWritable = true;
        if (key.pubkey.equals(proposalDepositPda.publicKey)) key.isWritable = true;
      }

      const createTx = new Transaction().add(createProposalIx);
      await sendAndConfirmTransaction(connection, createTx, [payer]);

      // Sign off → move to Voting state
      const signOffIx = await gov.signOffProposalInstruction(
        realmAccount,
        governanceAccount,
        proposalAccount,
        payer.publicKey,
        undefined,
        tokenOwnerRecord,
      );
      const signOffTx = new Transaction().add(signOffIx);
      await sendAndConfirmTransaction(connection, signOffTx, [payer]);

      console.log(`   ✓ ${proposalAccount.toBase58()} (Voting)`);
      proposalAddresses.push(proposalAccount.toBase58());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Too many outstanding proposals')) {
        console.log(`   ⚠ Skipped — governance has max outstanding proposals. Using existing ones.`);
        break; // No point trying more
      }
      console.error(`   ✗ Failed: ${msg}`);
    }
  }

  return proposalAddresses;
}

// ---------------------------------------------------------------------------
// Step 2: Create agents with Privy wallets
// ---------------------------------------------------------------------------

async function createAgents(): Promise<void> {
  console.log('\n=== Step 2: Creating AI agents ===\n');

  const existing = await getAllActiveAgents();
  if (existing.length >= 3) {
    console.log(`Already have ${existing.length} agents, skipping creation.`);
    return;
  }

  // Create a spending policy for all agent wallets
  console.log('Creating Privy spending policy...');
  const policy = await createPolicy({ maxSolPerTx: 0.1 });
  const policyId = policy.id;
  console.log(`   ✓ Policy: ${policyId}`);

  for (const [i, agentDef] of AGENTS.entries()) {
    console.log(`[${i + 1}/${AGENTS.length}] Creating agent: "${agentDef.name}"`);

    // Create Privy wallet
    const wallet = await createAgentWallet({
      policyIds: [policyId],
      label: `clawddao-${agentDef.name.toLowerCase().replace(/\s+/g, '-')}`,
    });
    console.log(`   Privy wallet: ${wallet.address} (${wallet.id})`);

    // Register in SpacetimeDB
    const result = await createAgent({
      name: agentDef.name,
      values_profile: agentDef.values_profile,
      config_json: JSON.stringify(agentDef.config),
      risk_tolerance: agentDef.risk_tolerance,
      owner_wallet: wallet.address,
      privy_wallet_id: wallet.id,
      privy_wallet_address: wallet.address,
    });

    if (!result.ok) {
      console.error(`   ✗ Failed: ${result.error}`);
    } else {
      console.log(`   ✓ Agent registered in SpacetimeDB`);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2.5: Fund agent wallets with SOL for tx fees
// ---------------------------------------------------------------------------

async function fundAgentWallets(connection: Connection, payer: Keypair): Promise<void> {
  console.log('\n=== Step 2.5: Funding agent wallets ===\n');

  const agents = await getAllActiveAgents();
  const FUND_AMOUNT = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL per agent (enough for ~30 votes)

  for (const agent of agents) {
    if (!agent.privy_wallet_address) continue;

    const dest = new PublicKey(agent.privy_wallet_address);
    const balance = await connection.getBalance(dest);

    if (balance >= FUND_AMOUNT) {
      console.log(`   ${agent.name}: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL (already funded)`);
      continue;
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: dest,
        lamports: FUND_AMOUNT,
      }),
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log(`   ✓ ${agent.name}: funded 0.05 SOL → ${agent.privy_wallet_address} (${sig.slice(0, 8)}...)`);
  }
}

// ---------------------------------------------------------------------------
// Step 3: Ensure realm is tracked
// ---------------------------------------------------------------------------

async function ensureRealmTracked(realmConfig: RealmConfig): Promise<void> {
  console.log('\n=== Step 3: Ensuring realm is tracked ===\n');

  const tracked = await getTrackedRealms();
  const alreadyTracked = tracked.some((r) => r.address === realmConfig.realmAccount);

  if (alreadyTracked) {
    console.log(`Realm ${realmConfig.realmAccount} already tracked.`);
    return;
  }

  const result = await addTrackedRealm({
    address: realmConfig.realmAccount,
    name: realmConfig.realmName,
  });

  if (!result.ok) {
    console.error(`Failed to track realm: ${result.error}`);
  } else {
    console.log(`✓ Tracked: ${realmConfig.realmName} (${realmConfig.realmAccount})`);
  }
}

// ---------------------------------------------------------------------------
// Step 4: Trigger worker cycle
// ---------------------------------------------------------------------------

async function triggerWorkerCycle(): Promise<void> {
  console.log('\n=== Step 4: Triggering worker cycle ===\n');
  console.log('Running a single worker cycle to vote on proposals...\n');

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════╗');
  console.log('║     ClawdDAO Demo Seed Script        ║');
  console.log('╚══════════════════════════════════════╝\n');

  const realmConfig = loadRealmConfig();
  console.log(`Realm: ${realmConfig.realmName}`);
  console.log(`Address: ${realmConfig.realmAccount}`);

  const connection = getConnection();
  const payer = getPayer();
  console.log(`Payer: ${payer.publicKey.toBase58()}`);

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 0.1 * 1e9) {
    console.log('\nLow balance — requesting devnet airdrop...');
    const sig = await connection.requestAirdrop(payer.publicKey, 2 * 1e9);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    console.log('Airdrop confirmed.');
  }

  // Step 1: Create proposals on devnet
  const skipProposals = process.argv.includes('--skip-proposals');
  if (skipProposals) {
    console.log('\n=== Step 1: Skipping proposal creation (--skip-proposals) ===');
  } else {
    await createProposals(connection, payer, realmConfig);
  }

  // Step 2: Create agents
  await createAgents();

  // Step 2.5: Fund agent wallets
  await fundAgentWallets(connection, payer);

  // Step 3: Track realm
  await ensureRealmTracked(realmConfig);

  // Step 4: Run worker
  await triggerWorkerCycle();

  console.log('\n✓ Demo seed complete! Refresh http://localhost:3001/feed to see activity.');
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err);
  process.exit(1);
});
