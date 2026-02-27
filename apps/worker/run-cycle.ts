import {
  fetchRealm,
  fetchProposalsForRealm,
  serializeProposal,
} from '@shared/lib/governance';
import {
  getAllActiveAgents,
  getTrackedRealms,
  hasAgentVoted,
  type AgentRow,
} from '@shared/lib/stdb-client';
import {
  executeAutonomousVote,
  isAgentEligibleForAutonomy,
  type GovernanceProposalContext,
  type AutonomousVoteResult,
} from '@shared/lib/autonomous-vote-engine';

export interface WorkerCycleOptions {
  dryRun: boolean;
  maxConcurrency: number;
  /** Delay in ms between sequential AI calls. Defaults to 3000. Set to 0 in tests. */
  throttleDelayMs?: number;
}

export interface WorkerCycleSummary {
  startedAt: string;
  finishedAt: string;
  agentsScanned: number;
  agentsEligible: number;
  activeProposals: number;
  combinationsConsidered: number;
  executed: number;
  skipped: number;
  failed: number;
}

interface AgentProposalPair {
  agent: AgentRow;
  proposal: GovernanceProposalContext;
}

function readMaxConcurrency(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

// Default throttle delay between sequential AI analysis calls (Z.AI rate limit)
const DEFAULT_THROTTLE_DELAY_MS = 3_000;

function isVotingStatus(status: string): boolean {
  return status.toLowerCase() === 'voting';
}

/** Check if a proposal's voting window is still open (not expired). */
function isVotingTimeActive(proposal: { votingEndAt?: string | null }): boolean {
  if (!proposal.votingEndAt) return true; // Can't determine — assume active
  return new Date(proposal.votingEndAt).getTime() > Date.now();
}

function normalizeProposalDescription(linkOrDescription: string): string {
  if (!linkOrDescription) return 'No proposal description provided.';
  return linkOrDescription;
}

function normalizeProposalStatus(status: string): string {
  return status ? status.toLowerCase() : 'unknown';
}

async function collectActiveProposals(): Promise<GovernanceProposalContext[]> {
  const trackedRealms = await getTrackedRealms();

  if (trackedRealms.length === 0) {
    console.log('[worker] No tracked realms found in database');
    return [];
  }

  const realmResults = await Promise.all(
    trackedRealms.map(async (realm) => {
      try {
        const { governances } = await fetchRealm(realm.address);
        const proposals = await fetchProposalsForRealm(realm.address, governances);
        // Extract votingBaseTime from governance config as fallback
        // (proposals may not have maxVotingTime set)
        const votingBaseTime = (governances[0] as unknown as { config?: { votingBaseTime?: number } })
          ?.config?.votingBaseTime ?? undefined;
        return proposals
          .map((p) => serializeProposal(p, votingBaseTime))
          .filter((proposal) => isVotingStatus(proposal.status) && isVotingTimeActive(proposal))
          .map((proposal) => ({
            address: proposal.address,
            title: proposal.title,
            description: normalizeProposalDescription(proposal.descriptionLink),
            realmName: realm.name,
            realmAddress: realm.address,
            forVotes: proposal.forVotes,
            againstVotes: proposal.againstVotes,
            abstainVotes: proposal.abstainVotes,
            status: normalizeProposalStatus(proposal.status),
          } satisfies GovernanceProposalContext));
      } catch (error) {
        console.error(`[worker] Failed to fetch proposals for realm ${realm.address}`, error);
        return [] as GovernanceProposalContext[];
      }
    }),
  );

  return realmResults.flat();
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
  throttleDelayMs = DEFAULT_THROTTLE_DELAY_MS,
): Promise<R[]> {
  if (items.length === 0) return [];

  const limit = readMaxConcurrency(concurrency);
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function workerLoop(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
      // Throttle to avoid Z.AI rate limits
      if (throttleDelayMs > 0 && cursor < items.length) {
        await new Promise((r) => setTimeout(r, throttleDelayMs));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, workerLoop));
  return results;
}

type FailedPairResult = { kind: 'failed'; reason: string };

type PairResult = AutonomousVoteResult | FailedPairResult;

function isAutonomousVoteResult(result: PairResult): result is AutonomousVoteResult {
  return 'executed' in result;
}

function summarizeResults(
  startedAt: string,
  agentsScanned: number,
  agentsEligible: number,
  activeProposals: number,
  combinationsConsidered: number,
  results: PairResult[],
): WorkerCycleSummary {
  let executed = 0;
  let skipped = 0;
  let failed = 0;

  for (const result of results) {
    if (!isAutonomousVoteResult(result)) {
      failed += 1;
      continue;
    }

    if (result.executed) {
      executed += 1;
    } else if (result.skipped) {
      skipped += 1;
    } else {
      // executed: false + skipped: false = on-chain tx failed
      failed += 1;
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    agentsScanned,
    agentsEligible,
    activeProposals,
    combinationsConsidered,
    executed,
    skipped,
    failed,
  };
}

export async function runWorkerCycle(options: WorkerCycleOptions): Promise<WorkerCycleSummary> {
  const startedAt = new Date().toISOString();
  console.log(`[worker] Starting cycle at ${startedAt}`);

  const allAgents = await getAllActiveAgents();
  const eligibleAgents = allAgents.filter(isAgentEligibleForAutonomy);
  const activeProposals = await collectActiveProposals();

  const pairs: AgentProposalPair[] = [];
  for (const agent of eligibleAgents) {
    for (const proposal of activeProposals) {
      pairs.push({ agent, proposal });
    }
  }

  const throttleDelayMs = options.throttleDelayMs ?? DEFAULT_THROTTLE_DELAY_MS;

  const results = await runWithConcurrency(
    pairs,
    options.maxConcurrency,
    async ({ agent, proposal }) => {
      try {
        const alreadyVoted = await hasAgentVoted(agent.id, proposal.address);
        if (alreadyVoted) {
          return {
            agentId: agent.id.toString(),
            proposalAddress: proposal.address,
            executed: false,
            skipped: true,
            skipReason: 'already_voted',
          } satisfies AutonomousVoteResult;
        }

        return await executeAutonomousVote({
          agent,
          proposal,
          dryRun: options.dryRun,
        });
      } catch (error) {
        console.error(
          `[worker] Pair execution failed for agent=${agent.id.toString()} proposal=${proposal.address}`,
          error,
        );
        return { kind: 'failed', reason: String(error) } as const;
      }
    },
    throttleDelayMs,
  );

  const summary = summarizeResults(
    startedAt,
    allAgents.length,
    eligibleAgents.length,
    activeProposals.length,
    pairs.length,
    results,
  );

  console.log('[worker] Cycle summary', JSON.stringify(summary));
  return summary;
}
