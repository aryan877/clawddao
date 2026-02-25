import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the run-cycle module since agent-worker.ts imports it at top level
vi.mock('../../apps/worker/run-cycle', () => ({
  runWorkerCycle: vi.fn(),
}));

import { getWorkerRuntimeConfig } from '../../apps/worker/agent-worker';

describe('getWorkerRuntimeConfig()', () => {
  let originalArgv: string[];

  beforeEach(() => {
    // Save and reset process.argv
    originalArgv = [...process.argv];
    process.argv = ['node', 'agent-worker.ts'];

    // Clear relevant env vars so defaults apply
    delete process.env.AGENT_WORKER_ENABLED;
    delete process.env.AGENT_WORKER_INTERVAL_MS;
    delete process.env.AGENT_WORKER_MAX_CONCURRENCY;
    delete process.env.AGENT_WORKER_DRY_RUN;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  // -------------------------------------------------------------------------
  // Default values
  // -------------------------------------------------------------------------
  it('returns defaults when no env vars or CLI args are set', () => {
    const config = getWorkerRuntimeConfig();
    expect(config.enabled).toBe(true);
    expect(config.intervalMs).toBe(30_000);
    expect(config.maxConcurrency).toBe(4);
    expect(config.dryRun).toBe(false);
    expect(config.runOnce).toBe(false);
  });

  // -------------------------------------------------------------------------
  // AGENT_WORKER_ENABLED env var
  // -------------------------------------------------------------------------
  it('reads AGENT_WORKER_ENABLED=false', () => {
    process.env.AGENT_WORKER_ENABLED = 'false';
    const config = getWorkerRuntimeConfig();
    expect(config.enabled).toBe(false);
  });

  it('reads AGENT_WORKER_ENABLED=0', () => {
    process.env.AGENT_WORKER_ENABLED = '0';
    const config = getWorkerRuntimeConfig();
    expect(config.enabled).toBe(false);
  });

  it('reads AGENT_WORKER_ENABLED=1', () => {
    process.env.AGENT_WORKER_ENABLED = '1';
    const config = getWorkerRuntimeConfig();
    expect(config.enabled).toBe(true);
  });

  it('reads AGENT_WORKER_ENABLED=true', () => {
    process.env.AGENT_WORKER_ENABLED = 'true';
    const config = getWorkerRuntimeConfig();
    expect(config.enabled).toBe(true);
  });

  it('reads AGENT_WORKER_ENABLED=yes', () => {
    process.env.AGENT_WORKER_ENABLED = 'yes';
    const config = getWorkerRuntimeConfig();
    expect(config.enabled).toBe(true);
  });

  it('reads AGENT_WORKER_ENABLED=on', () => {
    process.env.AGENT_WORKER_ENABLED = 'on';
    const config = getWorkerRuntimeConfig();
    expect(config.enabled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // AGENT_WORKER_INTERVAL_MS env var
  // -------------------------------------------------------------------------
  it('reads custom AGENT_WORKER_INTERVAL_MS', () => {
    process.env.AGENT_WORKER_INTERVAL_MS = '60000';
    const config = getWorkerRuntimeConfig();
    expect(config.intervalMs).toBe(60_000);
  });

  it('falls back to default for invalid AGENT_WORKER_INTERVAL_MS', () => {
    process.env.AGENT_WORKER_INTERVAL_MS = 'abc';
    const config = getWorkerRuntimeConfig();
    expect(config.intervalMs).toBe(30_000);
  });

  it('falls back to default for negative AGENT_WORKER_INTERVAL_MS', () => {
    process.env.AGENT_WORKER_INTERVAL_MS = '-100';
    const config = getWorkerRuntimeConfig();
    expect(config.intervalMs).toBe(30_000);
  });

  it('falls back to default for zero AGENT_WORKER_INTERVAL_MS', () => {
    process.env.AGENT_WORKER_INTERVAL_MS = '0';
    const config = getWorkerRuntimeConfig();
    expect(config.intervalMs).toBe(30_000);
  });

  // -------------------------------------------------------------------------
  // AGENT_WORKER_MAX_CONCURRENCY env var
  // -------------------------------------------------------------------------
  it('reads custom AGENT_WORKER_MAX_CONCURRENCY', () => {
    process.env.AGENT_WORKER_MAX_CONCURRENCY = '8';
    const config = getWorkerRuntimeConfig();
    expect(config.maxConcurrency).toBe(8);
  });

  // -------------------------------------------------------------------------
  // AGENT_WORKER_DRY_RUN env var
  // -------------------------------------------------------------------------
  it('reads AGENT_WORKER_DRY_RUN=true', () => {
    process.env.AGENT_WORKER_DRY_RUN = 'true';
    const config = getWorkerRuntimeConfig();
    expect(config.dryRun).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CLI --once flag
  // -------------------------------------------------------------------------
  it('detects --once CLI flag', () => {
    process.argv = ['node', 'agent-worker.ts', '--once'];
    const config = getWorkerRuntimeConfig();
    expect(config.runOnce).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CLI --dry-run flag
  // -------------------------------------------------------------------------
  it('detects --dry-run CLI flag', () => {
    process.argv = ['node', 'agent-worker.ts', '--dry-run'];
    const config = getWorkerRuntimeConfig();
    expect(config.dryRun).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Combined flags
  // -------------------------------------------------------------------------
  it('combines --once and --dry-run CLI flags', () => {
    process.argv = ['node', 'agent-worker.ts', '--once', '--dry-run'];
    const config = getWorkerRuntimeConfig();
    expect(config.runOnce).toBe(true);
    expect(config.dryRun).toBe(true);
  });

  it('CLI --dry-run overrides env var AGENT_WORKER_DRY_RUN=false', () => {
    process.env.AGENT_WORKER_DRY_RUN = 'false';
    process.argv = ['node', 'agent-worker.ts', '--dry-run'];
    const config = getWorkerRuntimeConfig();
    expect(config.dryRun).toBe(true);
  });
});
