/**
 * Quick script to run just the worker cycle.
 * Usage: DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/run-cycle-only.ts
 */
import { runWorkerCycle } from '../apps/worker/run-cycle';

async function main() {
  console.log('Starting worker cycle...\n');
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
  console.error('Worker cycle failed:', err);
  process.exit(1);
});
