import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createWorkerState,
  getHealthResponse,
  type WorkerState,
} from '../../apps/worker/server/state';

describe('createWorkerState()', () => {
  it('returns a WorkerState with all fields initialized', () => {
    const state = createWorkerState();

    expect(state.isRunning).toBe(false);
    expect(state.cycleInProgress).toBe(false);
    expect(state.startedAt).toBeNull();
    expect(state.lastCycleSummary).toBeNull();
    expect(state.lastCycleAt).toBeNull();
    expect(state.lastCycleError).toBeNull();
    expect(state.totalCyclesRun).toBe(0);
    expect(state.totalVotesExecuted).toBe(0);
    expect(state.totalVotesFailed).toBe(0);
    expect(state.nextCycleAt).toBeNull();
    expect(state.intervalMs).toBe(0);
  });

  it('returns a new object each time (no shared reference)', () => {
    const state1 = createWorkerState();
    const state2 = createWorkerState();

    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });

  it('state is mutable after creation', () => {
    const state = createWorkerState();
    state.isRunning = true;
    state.startedAt = new Date().toISOString();
    state.totalCyclesRun = 10;

    expect(state.isRunning).toBe(true);
    expect(state.startedAt).not.toBeNull();
    expect(state.totalCyclesRun).toBe(10);
  });
});

describe('getHealthResponse()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "starting" status when worker is not running', () => {
    const state = createWorkerState();
    const health = getHealthResponse(state);

    expect(health.status).toBe('starting');
    expect(health.uptime).toBe(0);
    expect(health.lastCycleAt).toBeNull();
    expect(health.cycleInProgress).toBe(false);
  });

  it('returns "ok" status when worker is running', () => {
    const state = createWorkerState();
    state.isRunning = true;
    state.startedAt = '2026-02-26T11:00:00Z';

    const health = getHealthResponse(state);

    expect(health.status).toBe('ok');
  });

  it('calculates uptime in seconds from startedAt', () => {
    const state = createWorkerState();
    state.isRunning = true;
    state.startedAt = '2026-02-26T11:00:00Z';

    const health = getHealthResponse(state);

    // 12:00:00 - 11:00:00 = 3600 seconds
    expect(health.uptime).toBe(3600);
  });

  it('returns 0 uptime when startedAt is null', () => {
    const state = createWorkerState();
    state.isRunning = true;
    state.startedAt = null;

    const health = getHealthResponse(state);
    expect(health.uptime).toBe(0);
  });

  it('reflects lastCycleAt from state', () => {
    const state = createWorkerState();
    state.isRunning = true;
    state.startedAt = '2026-02-26T11:00:00Z';
    state.lastCycleAt = '2026-02-26T11:55:00Z';

    const health = getHealthResponse(state);
    expect(health.lastCycleAt).toBe('2026-02-26T11:55:00Z');
  });

  it('reflects cycleInProgress from state', () => {
    const state = createWorkerState();
    state.isRunning = true;
    state.startedAt = '2026-02-26T11:00:00Z';
    state.cycleInProgress = true;

    const health = getHealthResponse(state);
    expect(health.cycleInProgress).toBe(true);
  });

  it('returns consistent shape with all required fields', () => {
    const state = createWorkerState();
    const health = getHealthResponse(state);

    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('uptime');
    expect(health).toHaveProperty('lastCycleAt');
    expect(health).toHaveProperty('cycleInProgress');

    // Verify no extra fields
    expect(Object.keys(health).sort()).toEqual(
      ['cycleInProgress', 'lastCycleAt', 'status', 'uptime'],
    );
  });

  it('handles startedAt far in the past correctly', () => {
    const state = createWorkerState();
    state.isRunning = true;
    state.startedAt = '2026-02-25T12:00:00Z'; // 24 hours ago

    const health = getHealthResponse(state);
    expect(health.uptime).toBe(86400); // 24 * 3600
  });

  it('handles worker that just started (uptime ~0)', () => {
    const state = createWorkerState();
    state.isRunning = true;
    state.startedAt = '2026-02-26T12:00:00Z'; // exactly now

    const health = getHealthResponse(state);
    expect(health.uptime).toBe(0);
  });
});
