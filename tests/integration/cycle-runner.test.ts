import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the run-cycle module
// ---------------------------------------------------------------------------
const mockRunWorkerCycle = vi.fn();

vi.mock('../../apps/worker/run-cycle', () => ({
  runWorkerCycle: mockRunWorkerCycle,
}));

import type { WorkerCycleSummary } from '../../apps/worker/run-cycle';
import type { WorkerState } from '../../apps/worker/server/state';
import type { WorkerRuntimeConfig } from '../../apps/worker/agent-worker';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<WorkerState> = {}): WorkerState {
  return {
    isRunning: true,
    cycleInProgress: false,
    startedAt: new Date().toISOString(),
    lastCycleSummary: null,
    lastCycleAt: null,
    lastCycleError: null,
    totalCyclesRun: 0,
    totalVotesExecuted: 0,
    totalVotesFailed: 0,
    nextCycleAt: null,
    intervalMs: 30000,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<WorkerRuntimeConfig> = {}): WorkerRuntimeConfig {
  return {
    enabled: true,
    intervalMs: 30000,
    maxConcurrency: 4,
    dryRun: false,
    runOnce: false,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<WorkerCycleSummary> = {}): WorkerCycleSummary {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    agentsScanned: 5,
    agentsEligible: 3,
    activeProposals: 2,
    combinationsConsidered: 6,
    executed: 4,
    skipped: 1,
    failed: 1,
    ...overrides,
  };
}

describe('cycle-runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // executeCycle
  // -----------------------------------------------------------------------
  describe('executeCycle', () => {
    it('calls runWorkerCycle with correct options and updates state', async () => {
      const summary = makeSummary({ executed: 3, skipped: 2, failed: 0 });
      mockRunWorkerCycle.mockResolvedValueOnce(summary);

      const { executeCycle } = await import('../../apps/worker/server/cycle-runner');
      const state = makeState();
      const config = makeConfig({ dryRun: false, maxConcurrency: 8 });

      const result = await executeCycle(state, config);

      expect(result).toEqual(summary);
      expect(mockRunWorkerCycle).toHaveBeenCalledWith({
        dryRun: false,
        maxConcurrency: 8,
      });

      // State should be updated
      expect(state.lastCycleSummary).toEqual(summary);
      expect(state.lastCycleAt).toBeDefined();
      expect(state.lastCycleError).toBeNull();
      expect(state.totalCyclesRun).toBe(1);
      expect(state.totalVotesExecuted).toBe(3);
      expect(state.totalVotesFailed).toBe(0);
      expect(state.cycleInProgress).toBe(false);
    });

    it('accumulates totals across multiple cycles', async () => {
      const summary1 = makeSummary({ executed: 2, failed: 1 });
      const summary2 = makeSummary({ executed: 3, failed: 0 });
      mockRunWorkerCycle
        .mockResolvedValueOnce(summary1)
        .mockResolvedValueOnce(summary2);

      const { executeCycle } = await import('../../apps/worker/server/cycle-runner');
      const state = makeState();
      const config = makeConfig();

      await executeCycle(state, config);
      await executeCycle(state, config);

      expect(state.totalCyclesRun).toBe(2);
      expect(state.totalVotesExecuted).toBe(5); // 2 + 3
      expect(state.totalVotesFailed).toBe(1);   // 1 + 0
    });

    it('sets lastCycleError and re-throws when cycle fails', async () => {
      mockRunWorkerCycle.mockRejectedValueOnce(new Error('RPC timeout'));

      const { executeCycle } = await import('../../apps/worker/server/cycle-runner');
      const state = makeState();
      const config = makeConfig();

      await expect(executeCycle(state, config)).rejects.toThrow('RPC timeout');

      expect(state.lastCycleError).toBe('Error: RPC timeout');
      expect(state.lastCycleAt).toBeDefined();
      expect(state.cycleInProgress).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // CycleInProgressError
  // -----------------------------------------------------------------------
  describe('CycleInProgressError', () => {
    it('throws when a cycle is already running', async () => {
      const { executeCycle, CycleInProgressError } = await import(
        '../../apps/worker/server/cycle-runner'
      );
      const state = makeState({ cycleInProgress: true });
      const config = makeConfig();

      await expect(executeCycle(state, config)).rejects.toThrow(CycleInProgressError);
      await expect(executeCycle(state, config)).rejects.toThrow(
        'Cycle already in progress',
      );

      // runWorkerCycle should NOT have been called
      expect(mockRunWorkerCycle).not.toHaveBeenCalled();
    });

    it('CycleInProgressError has correct name', async () => {
      const { CycleInProgressError } = await import(
        '../../apps/worker/server/cycle-runner'
      );
      const error = new CycleInProgressError();
      expect(error.name).toBe('CycleInProgressError');
      expect(error.message).toBe('Cycle already in progress');
      expect(error).toBeInstanceOf(Error);
    });
  });

  // -----------------------------------------------------------------------
  // executeDryRun
  // -----------------------------------------------------------------------
  describe('executeDryRun', () => {
    it('passes dryRun: true to runWorkerCycle', async () => {
      const summary = makeSummary({ executed: 0, skipped: 5, failed: 0 });
      mockRunWorkerCycle.mockResolvedValueOnce(summary);

      const { executeDryRun } = await import('../../apps/worker/server/cycle-runner');
      const state = makeState();
      const config = makeConfig({ dryRun: false, maxConcurrency: 2 });

      const result = await executeDryRun(state, config);

      expect(result).toEqual(summary);
      expect(mockRunWorkerCycle).toHaveBeenCalledWith({
        dryRun: true,
        maxConcurrency: 2,
      });
    });

    it('throws CycleInProgressError when cycle is already running', async () => {
      const { executeDryRun, CycleInProgressError } = await import(
        '../../apps/worker/server/cycle-runner'
      );
      const state = makeState({ cycleInProgress: true });
      const config = makeConfig();

      await expect(executeDryRun(state, config)).rejects.toThrow(
        CycleInProgressError,
      );
    });

    it('does not update lastCycleSummary or totalCyclesRun', async () => {
      const summary = makeSummary({ executed: 0, skipped: 3, failed: 0 });
      mockRunWorkerCycle.mockResolvedValueOnce(summary);

      const { executeDryRun } = await import('../../apps/worker/server/cycle-runner');
      const state = makeState();
      const config = makeConfig();

      await executeDryRun(state, config);

      // executeDryRun does NOT update these counters
      expect(state.totalCyclesRun).toBe(0);
      expect(state.totalVotesExecuted).toBe(0);
      expect(state.lastCycleSummary).toBeNull();
    });

    it('resets cycleInProgress even when runWorkerCycle throws', async () => {
      mockRunWorkerCycle.mockRejectedValueOnce(new Error('boom'));

      const { executeDryRun } = await import('../../apps/worker/server/cycle-runner');
      const state = makeState();
      const config = makeConfig();

      await expect(executeDryRun(state, config)).rejects.toThrow('boom');

      // cycleInProgress must be reset via finally block
      expect(state.cycleInProgress).toBe(false);
    });
  });
});
