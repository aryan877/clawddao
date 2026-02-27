import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['tests/integration/globalSetup.ts'],
    include: ['tests/integration/**/*.test.ts'],
    env: {
      SPACETIMEDB_URL: 'http://localhost:3200',
      SPACETIMEDB_MODULE_NAME: 'clawddao-test',
    },
    alias: {
      '@shared': path.resolve(__dirname, 'packages/shared'),
      '@': path.resolve(__dirname, 'apps/web'),
    },
    testTimeout: 30000,
  },
});
