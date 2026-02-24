import type { WorkerCycleSummary } from '../run-cycle';

// ---------------------------------------------------------------------------
// Worker State
// ---------------------------------------------------------------------------

export interface WorkerState {
  isRunning: boolean;
  cycleInProgress: boolean;
  startedAt: string | null;
  lastCycleSummary: WorkerCycleSummary | null;
  lastCycleAt: string | null;
  lastCycleError: string | null;
  totalCyclesRun: number;
  totalVotesExecuted: number;
  totalVotesFailed: number;
  nextCycleAt: string | null;
  intervalMs: number;
}

export interface HealthResponse {
  status: 'ok' | 'starting';
  uptime: number;
  lastCycleAt: string | null;
  cycleInProgress: boolean;
}

export interface StatusResponse extends WorkerState {
  config: {
    enabled: boolean;
    intervalMs: number;
    maxConcurrency: number;
    dryRun: boolean;
  };
}

export function createWorkerState(): WorkerState {
  return {
    isRunning: false,
    cycleInProgress: false,
    startedAt: null,
    lastCycleSummary: null,
    lastCycleAt: null,
    lastCycleError: null,
    totalCyclesRun: 0,
    totalVotesExecuted: 0,
    totalVotesFailed: 0,
    nextCycleAt: null,
    intervalMs: 0,
  };
}

export function getHealthResponse(state: WorkerState): HealthResponse {
  return {
    status: state.isRunning ? 'ok' : 'starting',
    uptime: state.startedAt
      ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)
      : 0,
    lastCycleAt: state.lastCycleAt,
    cycleInProgress: state.cycleInProgress,
  };
}
