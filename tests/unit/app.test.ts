import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the cycle-runner module so we never touch real worker cycles.
// ---------------------------------------------------------------------------

vi.mock('../../apps/worker/server/cycle-runner', () => {
  class CycleInProgressError extends Error {
    constructor() {
      super('Cycle already in progress');
      this.name = 'CycleInProgressError';
    }
  }

  return {
    executeCycle: vi.fn(),
    executeDryRun: vi.fn(),
    CycleInProgressError,
    startBackgroundLoop: vi.fn(() => ({ stop: vi.fn() })),
  };
});

import { createApp } from '../../apps/worker/server/app';
import type { WorkerState } from '../../apps/worker/server/state';
import { createWorkerState } from '../../apps/worker/server/state';
import type { WorkerRuntimeConfig } from '../../apps/worker/agent-worker';
import { executeCycle, executeDryRun, CycleInProgressError } from '../../apps/worker/server/cycle-runner';
import type { WorkerCycleSummary } from '../../apps/worker/run-cycle';
import type { Express } from 'express';

const mockExecuteCycle = vi.mocked(executeCycle);
const mockExecuteDryRun = vi.mocked(executeDryRun);

// ---------------------------------------------------------------------------
// Lightweight request helper (no supertest needed)
//
// Express apps can be tested by creating a mock req/res pair and calling
// the app's handle method directly. We use Node's built-in http module
// to spin up a short-lived server for each request.
// ---------------------------------------------------------------------------

import http from 'http';

async function request(
  app: Express,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const server = http.createServer(app);

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Failed to get server address'));
        return;
      }

      const options: http.RequestOptions = {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode ?? 500, body: parsed });
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<WorkerRuntimeConfig> = {}): WorkerRuntimeConfig {
  return {
    enabled: true,
    intervalMs: 30_000,
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
    agentsScanned: 2,
    agentsEligible: 1,
    activeProposals: 3,
    combinationsConsidered: 3,
    executed: 2,
    skipped: 1,
    failed: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Worker Express App', () => {
  let state: WorkerState;
  let config: WorkerRuntimeConfig;
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    state = createWorkerState();
    state.isRunning = true;
    state.startedAt = new Date().toISOString();
    config = makeConfig();
    app = createApp(state, config);
  });

  // -------------------------------------------------------------------------
  // GET /health
  // -------------------------------------------------------------------------
  describe('GET /health', () => {
    it('returns 200 with status', async () => {
      const res = await request(app, 'GET', '/health');

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('lastCycleAt');
      expect(body).toHaveProperty('cycleInProgress');
    });

    it('returns "starting" when worker is not yet running', async () => {
      state.isRunning = false;
      const res = await request(app, 'GET', '/health');

      const body = res.body as Record<string, unknown>;
      expect(body.status).toBe('starting');
    });
  });

  // -------------------------------------------------------------------------
  // GET /status
  // -------------------------------------------------------------------------
  describe('GET /status', () => {
    it('returns full worker state with config', async () => {
      state.totalCyclesRun = 5;
      state.totalVotesExecuted = 12;

      const res = await request(app, 'GET', '/status');

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;

      // State fields
      expect(body.isRunning).toBe(true);
      expect(body.totalCyclesRun).toBe(5);
      expect(body.totalVotesExecuted).toBe(12);

      // Config fields
      const cfg = body.config as Record<string, unknown>;
      expect(cfg.enabled).toBe(true);
      expect(cfg.intervalMs).toBe(30_000);
      expect(cfg.maxConcurrency).toBe(4);
      expect(cfg.dryRun).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /trigger
  // -------------------------------------------------------------------------
  describe('POST /trigger', () => {
    it('triggers a cycle and returns the summary', async () => {
      const summary = makeSummary({ executed: 3, failed: 0 });
      mockExecuteCycle.mockResolvedValue(summary);

      const res = await request(app, 'POST', '/trigger');

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.executed).toBe(3);
      expect(body.failed).toBe(0);
      expect(mockExecuteCycle).toHaveBeenCalledWith(state, config);
    });

    it('returns 409 when a cycle is already in progress', async () => {
      mockExecuteCycle.mockRejectedValue(new CycleInProgressError());

      const res = await request(app, 'POST', '/trigger');

      expect(res.status).toBe(409);
      const body = res.body as Record<string, unknown>;
      expect(body.error).toMatch(/already in progress/i);
    });

    it('returns 500 on unexpected errors', async () => {
      mockExecuteCycle.mockRejectedValue(new Error('Database unreachable'));

      const res = await request(app, 'POST', '/trigger');

      expect(res.status).toBe(500);
      const body = res.body as Record<string, unknown>;
      expect(body.error).toMatch(/Database unreachable/);
    });
  });

  // -------------------------------------------------------------------------
  // POST /cycle/dry-run
  // -------------------------------------------------------------------------
  describe('POST /cycle/dry-run', () => {
    it('triggers a dry-run cycle and returns the summary', async () => {
      const summary = makeSummary({ executed: 0, skipped: 3 });
      mockExecuteDryRun.mockResolvedValue(summary);

      const res = await request(app, 'POST', '/cycle/dry-run');

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.executed).toBe(0);
      expect(body.skipped).toBe(3);
      expect(mockExecuteDryRun).toHaveBeenCalledWith(state, config);
    });

    it('returns 409 when a cycle is already in progress', async () => {
      mockExecuteDryRun.mockRejectedValue(new CycleInProgressError());

      const res = await request(app, 'POST', '/cycle/dry-run');

      expect(res.status).toBe(409);
      const body = res.body as Record<string, unknown>;
      expect(body.error).toMatch(/already in progress/i);
    });
  });
});
