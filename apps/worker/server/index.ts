import { getWorkerRuntimeConfig } from '../agent-worker';
import { createWorkerState } from './state';
import { createApp } from './app';
import { executeCycle, startBackgroundLoop, type LoopHandle } from './cycle-runner';

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const config = getWorkerRuntimeConfig();
  const port = parseInt(process.env.WORKER_PORT || '4000', 10);

  if (!config.enabled) {
    console.log('[server] AGENT_WORKER_ENABLED is false; exiting.');
    return;
  }

  const state = createWorkerState();
  state.intervalMs = config.intervalMs;
  state.startedAt = new Date().toISOString();
  state.isRunning = true;

  const app = createApp(state, config);

  const httpServer = app.listen(port, () => {
    console.log(`[server] Worker HTTP server listening on :${port}`);
    console.log(`[server] Config: ${JSON.stringify(config)}`);
  });

  // Run first cycle immediately
  try {
    await executeCycle(state, config);
  } catch (error) {
    console.error('[server] Initial cycle failed', error);
  }

  // Start background loop
  const loop: LoopHandle = startBackgroundLoop(state, config);

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`[server] Received ${signal}, shutting down...`);
    state.isRunning = false;
    loop.stop();

    httpServer.close(() => {
      console.log('[server] HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      console.error('[server] Forced exit after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[server] Fatal error', error);
  process.exit(1);
});
