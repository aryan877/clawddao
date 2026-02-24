import { runWorkerCycle, type WorkerCycleSummary } from '../run-cycle';
import type { WorkerRuntimeConfig } from '../agent-worker';
import type { WorkerState } from './state';

// ---------------------------------------------------------------------------
// Cycle Execution
// ---------------------------------------------------------------------------

export async function executeCycle(
  state: WorkerState,
  config: WorkerRuntimeConfig,
): Promise<WorkerCycleSummary> {
  if (state.cycleInProgress) {
    throw new CycleInProgressError();
  }

  state.cycleInProgress = true;
  try {
    const summary = await runWorkerCycle({
      dryRun: config.dryRun,
      maxConcurrency: config.maxConcurrency,
    });

    state.lastCycleSummary = summary;
    state.lastCycleAt = new Date().toISOString();
    state.lastCycleError = null;
    state.totalCyclesRun += 1;
    state.totalVotesExecuted += summary.executed;
    state.totalVotesFailed += summary.failed;

    return summary;
  } catch (error) {
    state.lastCycleError = String(error);
    state.lastCycleAt = new Date().toISOString();
    throw error;
  } finally {
    state.cycleInProgress = false;
  }
}

export async function executeDryRun(
  state: WorkerState,
  config: WorkerRuntimeConfig,
): Promise<WorkerCycleSummary> {
  if (state.cycleInProgress) {
    throw new CycleInProgressError();
  }

  state.cycleInProgress = true;
  try {
    const summary = await runWorkerCycle({
      dryRun: true,
      maxConcurrency: config.maxConcurrency,
    });
    return summary;
  } finally {
    state.cycleInProgress = false;
  }
}

// ---------------------------------------------------------------------------
// Background Loop
// ---------------------------------------------------------------------------

export interface LoopHandle {
  stop(): void;
}

export function startBackgroundLoop(
  state: WorkerState,
  config: WorkerRuntimeConfig,
): LoopHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function scheduleNext(): void {
    if (stopped) return;

    state.nextCycleAt = new Date(Date.now() + config.intervalMs).toISOString();

    timer = setTimeout(async () => {
      try {
        await executeCycle(state, config);
      } catch (error) {
        console.error('[server] Background cycle failed', error);
      }
      scheduleNext();
    }, config.intervalMs);
  }

  scheduleNext();

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CycleInProgressError extends Error {
  constructor() {
    super('Cycle already in progress');
    this.name = 'CycleInProgressError';
  }
}
