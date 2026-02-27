import { runWorkerCycle } from './run-cycle';

function readBoolEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function readIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WorkerRuntimeConfig {
  enabled: boolean;
  intervalMs: number;
  maxConcurrency: number;
  dryRun: boolean;
  runOnce: boolean;
}

export function getWorkerRuntimeConfig(): WorkerRuntimeConfig {
  const runOnceFlag = process.argv.includes('--once');
  const dryRunArg = process.argv.includes('--dry-run');

  return {
    enabled: readBoolEnv('AGENT_WORKER_ENABLED', true),
    intervalMs: readIntEnv('AGENT_WORKER_INTERVAL_MS', 30_000),
    maxConcurrency: readIntEnv('AGENT_WORKER_MAX_CONCURRENCY', 1),
    dryRun: dryRunArg || readBoolEnv('AGENT_WORKER_DRY_RUN', false),
    runOnce: runOnceFlag,
  };
}

async function runLoop(config: WorkerRuntimeConfig): Promise<void> {
  while (true) {
    try {
      await runWorkerCycle({
        dryRun: config.dryRun,
        maxConcurrency: config.maxConcurrency,
      });
    } catch (error) {
      console.error('[worker] Cycle failed', error);
    }

    if (config.runOnce) {
      return;
    }

    await sleep(config.intervalMs);
  }
}

export async function startAgentWorker(): Promise<void> {
  const config = getWorkerRuntimeConfig();

  if (!config.enabled) {
    console.log('[worker] AGENT_WORKER_ENABLED is false; exiting.');
    return;
  }

  console.log('[worker] Starting autonomous agent worker', JSON.stringify(config));
  await runLoop(config);
}

if (require.main === module) {
  startAgentWorker().catch((error) => {
    console.error('[worker] Fatal worker error', error);
    process.exit(1);
  });
}
