import express, { type Request, type Response } from 'express';
import type { WorkerRuntimeConfig } from '../agent-worker';
import type { WorkerState, StatusResponse } from './state';
import { getHealthResponse } from './state';
import { executeCycle, executeDryRun, CycleInProgressError } from './cycle-runner';

// ---------------------------------------------------------------------------
// Express App Factory
// ---------------------------------------------------------------------------

export function createApp(
  state: WorkerState,
  config: WorkerRuntimeConfig,
): express.Application {
  const app = express();
  app.use(express.json());

  // GET /health — Docker healthcheck
  app.get('/health', (_req: Request, res: Response) => {
    res.json(getHealthResponse(state));
  });

  // GET /status — Full worker state + config
  app.get('/status', (_req: Request, res: Response) => {
    const response: StatusResponse = {
      ...state,
      config: {
        enabled: config.enabled,
        intervalMs: config.intervalMs,
        maxConcurrency: config.maxConcurrency,
        dryRun: config.dryRun,
      },
    };
    res.json(response);
  });

  // POST /trigger — Manual cycle trigger
  app.post('/trigger', async (_req: Request, res: Response) => {
    try {
      const summary = await executeCycle(state, config);
      res.json(summary);
    } catch (error) {
      if (error instanceof CycleInProgressError) {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: String(error) });
    }
  });

  // POST /cycle/dry-run — Dry-run trigger
  app.post('/cycle/dry-run', async (_req: Request, res: Response) => {
    try {
      const summary = await executeDryRun(state, config);
      res.json(summary);
    } catch (error) {
      if (error instanceof CycleInProgressError) {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: String(error) });
    }
  });

  return app;
}
