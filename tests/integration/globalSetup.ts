/**
 * Vitest globalSetup: spins up an isolated SpacetimeDB Docker container,
 * waits for health, publishes the module, and tears down after all tests.
 *
 * Run via: npm run test:integration
 */
import { execSync, type ExecSyncOptions } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import path from 'path';

const COMPOSE_FILE = 'tests/docker-compose.test.yml';
const STDB_TEST_URL = 'http://localhost:3200';
const MODULE_NAME = 'clawddao-test';
const MAX_WAIT_MS = 30_000;
const ENV_FILE = path.resolve(__dirname, '.env.integration');

const execOpts: ExecSyncOptions = {
  cwd: process.cwd(),
  stdio: 'pipe',
  encoding: 'utf-8' as BufferEncoding,
};

async function waitForHealth(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const res = await fetch(`${STDB_TEST_URL}/v1/ping`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`SpacetimeDB test instance did not become healthy within ${MAX_WAIT_MS}ms`);
}

export async function setup() {
  console.log('[test-setup] Starting SpacetimeDB test container...');
  try {
    execSync(`docker compose -f ${COMPOSE_FILE} up -d --wait`, execOpts);
  } catch (e) {
    // --wait may not be supported on older docker compose
    execSync(`docker compose -f ${COMPOSE_FILE} up -d`, execOpts);
  }

  await waitForHealth();
  console.log('[test-setup] SpacetimeDB is healthy.');

  // Publish the module
  console.log('[test-setup] Publishing module...');
  try {
    execSync(
      `spacetime publish ${MODULE_NAME} -p spacetimedb/ -s ${STDB_TEST_URL} --anonymous -y`,
      { ...execOpts, stdio: 'inherit' },
    );
  } catch {
    console.warn('[test-setup] spacetime CLI publish failed — module may already exist or CLI not installed.');
    console.warn('[test-setup] Tests will still run against the SpacetimeDB instance.');
  }

  // Write env file for test workers (globalSetup runs in separate process)
  writeFileSync(ENV_FILE, `SPACETIMEDB_URL=${STDB_TEST_URL}\nSPACETIMEDB_MODULE_NAME=${MODULE_NAME}\n`);
}

export async function teardown() {
  console.log('[test-setup] Tearing down SpacetimeDB test container...');
  try {
    execSync(`docker compose -f ${COMPOSE_FILE} down -v`, execOpts);
  } catch {
    // best effort
  }
  try {
    unlinkSync(ENV_FILE);
  } catch {
    // best effort
  }
}
