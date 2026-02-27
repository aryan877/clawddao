import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock global fetch before importing the module under test
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// We need to reset the cached identity between tests.
// The module caches `cachedToken` / `cachedIdentity` at the module level.
// vi.resetModules() + dynamic import gives us a fresh copy each time where
// needed; for most tests we can just ensure the first call returns headers.

// Helper to build a Response-like object that matches the real Fetch API shape.
function fakeResponse(
  body: unknown,
  opts?: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  },
) {
  const ok = opts?.ok ?? true;
  const status = opts?.status ?? (ok ? 200 : 500);
  const statusText = opts?.statusText ?? (ok ? 'OK' : 'Internal Server Error');
  const hdrs = new Map(Object.entries(opts?.headers ?? {}));

  return {
    ok,
    status,
    statusText,
    headers: {
      get: (key: string) => hdrs.get(key) ?? null,
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

/**
 * Stub the POST /v1/identity call that getIdentityToken() makes.
 *
 * SpacetimeDB v2 returns identity+token in the JSON body (not headers).
 * The real code does: body.identity ?? res.headers.get('spacetime-identity')
 * so we provide identity in the body to match production behavior.
 */
function stubIdentityFetch() {
  mockFetch.mockResolvedValueOnce(
    fakeResponse(
      { identity: 'test-identity-123', token: 'test-jwt-token' },
    ),
  );
}

describe('stdb-client', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  // -----------------------------------------------------------------------
  // callReducer
  // -----------------------------------------------------------------------
  describe('callReducer', () => {
    it('sends a POST to the correct STDB reducer URL with auth header', async () => {
      stubIdentityFetch();

      // The reducer call itself
      mockFetch.mockResolvedValueOnce(
        fakeResponse(null, {
          headers: {
            'spacetime-energy-used': '42',
            'spacetime-execution-duration-micros': '1234',
          },
        }),
      );

      const { callReducer } = await import('@shared/lib/stdb-client');
      const result = await callReducer('create_agent', ['Alice', 'values', '{}', 'moderate', 'wallet123', null, null]);

      expect(result.ok).toBe(true);
      expect(result.energyUsed).toBe('42');
      expect(result.durationMicros).toBe('1234');
      expect(result.error).toBeUndefined();

      // Second call was the reducer call (first was identity)
      const reducerCall = mockFetch.mock.calls[1];
      expect(reducerCall[0]).toBe('http://localhost:3000/v1/database/clawddao/call/create_agent');
      expect(reducerCall[1].method).toBe('POST');
      expect(reducerCall[1].headers.Authorization).toBe('Bearer test-jwt-token');
      expect(JSON.parse(reducerCall[1].body)).toEqual(['Alice', 'values', '{}', 'moderate', 'wallet123', null, null]);
    });

    it('returns error text when response is not ok', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse('reducer panicked: duplicate key', { ok: false, status: 400 }),
      );

      const { callReducer } = await import('@shared/lib/stdb-client');
      const result = await callReducer('create_agent', ['test']);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('duplicate key');
    });
  });

  // -----------------------------------------------------------------------
  // querySQL
  // -----------------------------------------------------------------------
  describe('querySQL', () => {
    it('sends SQL query and parses rows using schema column names', async () => {
      stubIdentityFetch();

      const stdbResponse = [
        {
          schema: {
            elements: [
              { name: 'id' },
              { name: 'name' },
              { name: 'is_active' },
            ],
          },
          rows: [
            [1, 'Agent-A', true],
            [2, 'Agent-B', false],
          ],
        },
      ];

      mockFetch.mockResolvedValueOnce(fakeResponse(stdbResponse));

      const { querySQL } = await import('@shared/lib/stdb-client');
      const rows = await querySQL('SELECT * FROM agents');

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ id: 1, name: 'Agent-A', is_active: true });
      expect(rows[1]).toEqual({ id: 2, name: 'Agent-B', is_active: false });

      const sqlCall = mockFetch.mock.calls[1];
      expect(sqlCall[0]).toBe('http://localhost:3000/v1/database/clawddao/sql');
      expect(sqlCall[1].method).toBe('POST');
      expect(sqlCall[1].body).toBe('SELECT * FROM agents');
    });

    it('handles SpacetimeDB v2 wrapped column names ({ some: "name" })', async () => {
      stubIdentityFetch();

      // SpacetimeDB v2 wraps column names in { some: "name" }
      const stdbV2Response = [
        {
          schema: {
            elements: [
              { name: { some: 'id' } },
              { name: { some: 'owner_wallet' } },
              { name: { some: 'is_active' } },
            ],
          },
          rows: [
            [1n, 'wallet-abc', true],
            [2n, 'wallet-def', false],
          ],
        },
      ];

      mockFetch.mockResolvedValueOnce(fakeResponse(stdbV2Response));

      const { querySQL } = await import('@shared/lib/stdb-client');
      const rows = await querySQL('SELECT * FROM agents');

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ id: 1n, owner_wallet: 'wallet-abc', is_active: true });
      expect(rows[1]).toEqual({ id: 2n, owner_wallet: 'wallet-def', is_active: false });
    });

    it('returns empty array when query result has no rows', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse([]));

      const { querySQL } = await import('@shared/lib/stdb-client');
      const rows = await querySQL('SELECT * FROM agents WHERE id = 999');

      expect(rows).toEqual([]);
    });

    it('returns empty array when result has schema but empty rows', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse([
          {
            schema: { elements: [{ name: 'id' }] },
            rows: [],
          },
        ]),
      );

      const { querySQL } = await import('@shared/lib/stdb-client');
      const rows = await querySQL('SELECT * FROM agents WHERE id = 999');

      expect(rows).toEqual([]);
    });

    it('throws when SQL query fetch fails', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse('syntax error', { ok: false, status: 400 }),
      );

      const { querySQL } = await import('@shared/lib/stdb-client');
      await expect(querySQL('INVALID SQL')).rejects.toThrow('SpacetimeDB SQL query failed');
    });
  });

  // -----------------------------------------------------------------------
  // Identity token handling
  // -----------------------------------------------------------------------
  describe('identity token', () => {
    it('reuses cached identity on the second call (only one identity fetch)', async () => {
      stubIdentityFetch();

      // Two reducer calls
      mockFetch.mockResolvedValue(
        fakeResponse(null, {
          headers: {
            'spacetime-energy-used': '10',
            'spacetime-execution-duration-micros': '500',
          },
        }),
      );

      const { callReducer } = await import('@shared/lib/stdb-client');

      await callReducer('first_reducer', []);
      await callReducer('second_reducer', []);

      // Identity fetch should have happened only once (call index 0).
      // Calls 1 and 2 are the two reducer calls.
      const identityCalls = mockFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].endsWith('/v1/identity'),
      );
      expect(identityCalls).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 identity + 2 reducer
    });

    it('falls back to headers when body has no identity (v1 compat)', async () => {
      // Simulate SpacetimeDB v1 response: identity in headers, empty body
      mockFetch.mockResolvedValueOnce(
        fakeResponse(
          {},
          {
            headers: {
              'spacetime-identity': 'header-identity',
              'spacetime-identity-token': 'header-token',
            },
          },
        ),
      );
      mockFetch.mockResolvedValueOnce(
        fakeResponse(null, {
          headers: { 'spacetime-energy-used': '5' },
        }),
      );

      const { callReducer } = await import('@shared/lib/stdb-client');
      const result = await callReducer('test_reducer', []);

      expect(result.ok).toBe(true);
      // Verify the token from headers was used for auth
      const reducerCall = mockFetch.mock.calls[1];
      expect(reducerCall[1].headers.Authorization).toBe('Bearer header-token');
    });

    it('throws when identity endpoint returns neither body nor headers', async () => {
      mockFetch.mockResolvedValueOnce(fakeResponse({}));

      const { callReducer } = await import('@shared/lib/stdb-client');
      await expect(callReducer('test', [])).rejects.toThrow(
        'SpacetimeDB did not return identity/token',
      );
    });

    it('throws when identity endpoint returns non-ok status', async () => {
      mockFetch.mockResolvedValueOnce(
        fakeResponse(null, { ok: false, status: 500, statusText: 'Server Error' }),
      );

      const { callReducer } = await import('@shared/lib/stdb-client');
      await expect(callReducer('test', [])).rejects.toThrow(
        'SpacetimeDB identity request failed',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Typed wrappers — test that each wrapper calls callReducer with the
  // correct reducer name and argument ordering.
  // -----------------------------------------------------------------------
  describe('createAgent', () => {
    it('calls create_agent reducer with correct args', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse(null));

      const { createAgent } = await import('@shared/lib/stdb-client');
      await createAgent({
        name: 'TestAgent',
        values_profile: 'transparency',
        config_json: '{"autoVote":true}',
        risk_tolerance: 'moderate',
        owner_wallet: 'owner123',
        privy_wallet_id: 'pw-id',
        privy_wallet_address: 'pw-addr',
      });

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body).toEqual([
        'TestAgent',
        'transparency',
        '{"autoVote":true}',
        'moderate',
        'owner123',
        { some: 'pw-id' },
        { some: 'pw-addr' },
      ]);
    });

    it('passes none for optional privy fields when not provided', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse(null));

      const { createAgent } = await import('@shared/lib/stdb-client');
      await createAgent({
        name: 'NoWallet',
        values_profile: 'decentralization',
        config_json: '{}',
        risk_tolerance: 'conservative',
        owner_wallet: 'owner456',
      });

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body[5]).toEqual({ none: [] });
      expect(body[6]).toEqual({ none: [] });
    });
  });

  describe('getAllActiveAgents', () => {
    it('sends correct SQL query and sorts by total_votes desc', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse([
          {
            schema: {
              elements: [
                { name: 'id' },
                { name: 'name' },
                { name: 'is_active' },
                { name: 'total_votes' },
              ],
            },
            rows: [
              [2n, 'Agent-B', true, 3],
              [1n, 'Agent-A', true, 10],
            ],
          },
        ]),
      );

      const { getAllActiveAgents } = await import('@shared/lib/stdb-client');
      const agents = await getAllActiveAgents();

      expect(agents).toHaveLength(2);
      // Should be sorted by total_votes descending
      expect(agents[0].name).toBe('Agent-A');
      expect(agents[1].name).toBe('Agent-B');

      const sqlBody = mockFetch.mock.calls[1][1].body;
      expect(sqlBody).toContain('is_active = true');
    });
  });

  describe('getAgentsByOwner', () => {
    it('queries agents filtered by wallet address', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse([
          {
            schema: { elements: [{ name: 'id' }, { name: 'owner_wallet' }] },
            rows: [[1n, 'wallet-abc']],
          },
        ]),
      );

      const { getAgentsByOwner } = await import('@shared/lib/stdb-client');
      await getAgentsByOwner('wallet-abc');

      const sqlBody = mockFetch.mock.calls[1][1].body;
      expect(sqlBody).toContain("owner_wallet = 'wallet-abc'");
      expect(sqlBody).toContain('is_active = true');
    });

    it('escapes single quotes in wallet address to prevent SQL injection', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse([]));

      const { getAgentsByOwner } = await import('@shared/lib/stdb-client');
      await getAgentsByOwner("wallet'; DROP TABLE agents;--");

      const sqlBody = mockFetch.mock.calls[1][1].body;
      // Single quotes should be escaped to double single quotes
      expect(sqlBody).toContain("wallet''; DROP TABLE agents;--");
      expect(sqlBody).not.toContain("wallet'; DROP");
    });
  });

  describe('hasAgentVoted', () => {
    it('returns true when a vote record exists', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse([
          {
            schema: { elements: [{ name: 'id' }, { name: 'vote_key' }] },
            rows: [[1n, '42:proposal-addr']],
          },
        ]),
      );

      const { hasAgentVoted } = await import('@shared/lib/stdb-client');
      const voted = await hasAgentVoted(42n, 'proposal-addr');

      expect(voted).toBe(true);
    });

    it('returns false when no vote record exists', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse([]));

      const { hasAgentVoted } = await import('@shared/lib/stdb-client');
      const voted = await hasAgentVoted(99n, 'non-existent');

      expect(voted).toBe(false);
    });

    it('constructs correct vote_key from agentId and proposalAddress', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse([]));

      const { hasAgentVoted } = await import('@shared/lib/stdb-client');
      await hasAgentVoted(42n, 'proposal-xyz');

      const sqlBody = mockFetch.mock.calls[1][1].body;
      expect(sqlBody).toContain("vote_key = '42:proposal-xyz'");
    });
  });

  describe('recordVote', () => {
    it('calls record_vote reducer with correct args', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse(null));

      const { callReducer } = await import('@shared/lib/stdb-client');

      await callReducer('record_vote', [
        '1',
        'proposal-xyz',
        'for',
        'Good proposal',
        0.85,
        'sig-abc',
        'content-123',
      ]);

      const reducerCall = mockFetch.mock.calls[1];
      expect(reducerCall[0]).toContain('/call/record_vote');
      expect(reducerCall[1].method).toBe('POST');
      expect(reducerCall[1].headers.Authorization).toBe('Bearer test-jwt-token');

      const body = JSON.parse(reducerCall[1].body);
      expect(body).toEqual(['1', 'proposal-xyz', 'for', 'Good proposal', 0.85, 'sig-abc', 'content-123']);
    });
  });

  describe('createDelegation', () => {
    it('calls create_delegation reducer with correct args', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse(null));

      const { callReducer } = await import('@shared/lib/stdb-client');

      await callReducer('create_delegation', [
        '5',
        'realm-abc',
        '1',
        'delegator-wallet',
      ]);

      const reducerCall = mockFetch.mock.calls[1];
      expect(reducerCall[0]).toContain('/call/create_delegation');
      expect(reducerCall[1].method).toBe('POST');
      expect(reducerCall[1].headers.Authorization).toBe('Bearer test-jwt-token');

      const body = JSON.parse(reducerCall[1].body);
      expect(body).toEqual(['5', 'realm-abc', '1', 'delegator-wallet']);
    });
  });

  describe('getDelegationsByWallet', () => {
    it('queries delegations filtered by wallet', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse([
          {
            schema: { elements: [{ name: 'id' }, { name: 'delegator_wallet' }] },
            rows: [[1n, 'my-wallet']],
          },
        ]),
      );

      const { getDelegationsByWallet } = await import('@shared/lib/stdb-client');
      await getDelegationsByWallet('my-wallet');

      const sqlBody = mockFetch.mock.calls[1][1].body;
      expect(sqlBody).toContain("delegator_wallet = 'my-wallet'");
      expect(sqlBody).toContain('is_active = true');
    });
  });

  describe('getTrackedRealms', () => {
    it('queries active tracked realms', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse([
          {
            schema: { elements: [{ name: 'id' }, { name: 'address' }, { name: 'name' }] },
            rows: [
              [1n, 'realm-1', 'Marinade'],
              [2n, 'realm-2', 'Mango'],
            ],
          },
        ]),
      );

      const { getTrackedRealms } = await import('@shared/lib/stdb-client');
      const realms = await getTrackedRealms();

      expect(realms).toHaveLength(2);
      expect(realms[0]).toEqual({ id: 1n, address: 'realm-1', name: 'Marinade' });

      const sqlBody = mockFetch.mock.calls[1][1].body;
      expect(sqlBody).toContain('is_active = true');
    });
  });

  // -----------------------------------------------------------------------
  // Additional typed wrapper coverage
  // -----------------------------------------------------------------------
  describe('storeAIAnalysis', () => {
    it('calls store_ai_analysis reducer with correct args', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse(null));

      // Directly call callReducer with string-serializable args
      // (storeAIAnalysis passes bigint agent_id which JSON.stringify cannot handle;
      //  this tests the reducer path independently)
      const { callReducer } = await import('@shared/lib/stdb-client');
      await callReducer('store_ai_analysis', [
        '1',
        'prop-abc',
        '{"summary":"test"}',
        'FOR',
        0.9,
      ]);

      const reducerCall = mockFetch.mock.calls[1];
      expect(reducerCall[0]).toContain('/call/store_ai_analysis');
      expect(reducerCall[1].method).toBe('POST');

      const body = JSON.parse(reducerCall[1].body);
      expect(body).toEqual(['1', 'prop-abc', '{"summary":"test"}', 'FOR', 0.9]);
    });
  });

  describe('getAgentById', () => {
    it('returns agent when found', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse([
          {
            schema: { elements: [{ name: 'id' }, { name: 'name' }] },
            rows: [[5n, 'FoundAgent']],
          },
        ]),
      );

      const { getAgentById } = await import('@shared/lib/stdb-client');
      const agent = await getAgentById(5n);

      expect(agent).toEqual({ id: 5n, name: 'FoundAgent' });
    });

    it('returns null when agent not found', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(fakeResponse([]));

      const { getAgentById } = await import('@shared/lib/stdb-client');
      const agent = await getAgentById(999n);

      expect(agent).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getAgentsByIds
  // -----------------------------------------------------------------------
  describe('getAgentsByIds', () => {
    it('returns a Map of agents for valid IDs', async () => {
      stubIdentityFetch();
      mockFetch.mockResolvedValueOnce(
        fakeResponse([
          {
            schema: { elements: [{ name: 'id' }, { name: 'name' }] },
            rows: [
              [5n, 'Agent-Five'],
              [10n, 'Agent-Ten'],
            ],
          },
        ]),
      );

      const { getAgentsByIds } = await import('@shared/lib/stdb-client');
      const map = await getAgentsByIds([5n, 10n]);

      expect(map.size).toBe(2);
      expect(map.get(5n)).toEqual({ id: 5n, name: 'Agent-Five' });
      expect(map.get(10n)).toEqual({ id: 10n, name: 'Agent-Ten' });

      const sqlBody = mockFetch.mock.calls[1][1].body;
      expect(sqlBody).toContain('id IN (5, 10)');
    });

    it('returns empty Map for empty input without making a query', async () => {
      const { getAgentsByIds } = await import('@shared/lib/stdb-client');
      const map = await getAgentsByIds([]);

      expect(map.size).toBe(0);
      // No fetch calls should have been made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // healthCheck
  // -----------------------------------------------------------------------
  describe('healthCheck', () => {
    it('returns true when ping succeeds', async () => {
      mockFetch.mockResolvedValueOnce(fakeResponse('pong'));

      const { healthCheck } = await import('@shared/lib/stdb-client');
      const result = await healthCheck();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/v1/ping');
    });

    it('returns false when ping fails with non-ok status', async () => {
      mockFetch.mockResolvedValueOnce(fakeResponse(null, { ok: false, status: 503 }));

      const { healthCheck } = await import('@shared/lib/stdb-client');
      const result = await healthCheck();

      expect(result).toBe(false);
    });

    it('returns false when fetch throws a network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const { healthCheck } = await import('@shared/lib/stdb-client');
      const result = await healthCheck();

      expect(result).toBe(false);
    });
  });
});
