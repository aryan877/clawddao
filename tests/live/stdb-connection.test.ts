import { describe, it, expect } from 'vitest';

describe.skipIf(!process.env.LIVE_TEST)('SpacetimeDB Live Connection', () => {
  it('connects to SpacetimeDB via health check', async () => {
    const { healthCheck } = await import('@shared/lib/stdb-client');
    const ok = await healthCheck();
    expect(ok).toBe(true);
  });

  it('obtains identity token from SpacetimeDB', async () => {
    // callReducer internally calls getIdentityToken; if identity fails, this throws
    const { querySQL } = await import('@shared/lib/stdb-client');
    // A simple query that should always work on any module
    const result = await querySQL('SELECT * FROM agents LIMIT 1');
    // Result is an array (possibly empty if no agents exist yet)
    expect(Array.isArray(result)).toBe(true);
  });

  it('can call a reducer without crashing', async () => {
    // seed_tracked_realms is idempotent — safe to call repeatedly
    const { seedTrackedRealms } = await import('@shared/lib/stdb-client');
    const result = await seedTrackedRealms();
    // The reducer should succeed (ok: true) or fail with a known error
    expect(typeof result.ok).toBe('boolean');
  });

  it('can query tracked_realms table', async () => {
    const { getTrackedRealms } = await import('@shared/lib/stdb-client');
    const realms = await getTrackedRealms();
    expect(Array.isArray(realms)).toBe(true);
    if (realms.length > 0) {
      expect(realms[0]).toHaveProperty('address');
      expect(realms[0]).toHaveProperty('name');
      expect(realms[0]).toHaveProperty('is_active');
    }
  });
});
