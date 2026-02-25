import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/live/**/*.test.ts'],
    alias: {
      '@shared': path.resolve(__dirname, 'packages/shared'),
      '@': path.resolve(__dirname, 'apps/web'),
    },
    testTimeout: 60000,
  },
});
