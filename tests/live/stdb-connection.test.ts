import { describe, it, expect } from 'vitest';
import { healthCheck } from '@shared/lib/stdb-client';

describe.skipIf(!process.env.LIVE_TEST)('SpacetimeDB Live Connection', () => {
  it('connects to SpacetimeDB', async () => {
    const ok = await healthCheck();
    expect(ok).toBe(true);
  });
});
