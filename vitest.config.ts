import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/live/**'],
    alias: {
      '@shared': path.resolve(__dirname, 'packages/shared'),
      '@': path.resolve(__dirname, 'apps/web'),
    },
    coverage: {
      provider: 'v8',
      include: [
        'packages/shared/lib/**',
        'apps/web/app/api/**',
        'apps/worker/**',
      ],
    },
  },
});
