import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock global fetch before importing the module under test
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to build a Response-like object
function fakeResponse(
  body: unknown,
  opts?: { ok?: boolean; status?: number; headers?: Record<string, string> },
) {
  const ok = opts?.ok ?? true;
  const status = opts?.status ?? (ok ? 200 : 500);
  const hdrs = new Map(Object.entries(opts?.headers ?? {}));

  return {
    ok,
    status,
    headers: { get: (k: string) => hdrs.get(k) ?? null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('privy-client', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  // -----------------------------------------------------------------------
  // isConfigured
  // -----------------------------------------------------------------------
  describe('isConfigured', () => {
    it('returns true when PRIVY_APP_ID and PRIVY_APP_SECRET are set', async () => {
      // Ensure env vars are set before module import
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      const { isConfigured } = await import('@shared/lib/privy-client');
      expect(isConfigured()).toBe(true);
    });

    it('returns false when PRIVY_APP_ID is empty', async () => {
      const origId = process.env.PRIVY_APP_ID;
      const origSecret = process.env.PRIVY_APP_SECRET;
      process.env.PRIVY_APP_ID = '';
      process.env.PRIVY_APP_SECRET = '';

      const { isConfigured } = await import('@shared/lib/privy-client');
      const result = isConfigured();

      // Restore
      process.env.PRIVY_APP_ID = origId;
      process.env.PRIVY_APP_SECRET = origSecret;

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // createPolicy
  // -----------------------------------------------------------------------
  describe('createPolicy', () => {
    it('sends correct POST with Basic auth and returns policy', async () => {
      // Ensure env vars are set before module import
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      const expectedAuth =
        'Basic ' + Buffer.from('test-app-id:test-app-secret').toString('base64');

      const policyResponse = {
        id: 'policy-123',
        name: 'Agent voting policy',
        rules: [
          { name: 'Max 0.1 SOL per transaction', action: 'ALLOW' },
          { name: 'Chain devnet only', action: 'ALLOW' },
        ],
      };

      mockFetch.mockResolvedValueOnce(fakeResponse(policyResponse));

      const { createPolicy } = await import('@shared/lib/privy-client');
      const result = await createPolicy({ maxSolPerTx: 0.1 });

      expect(result.id).toBe('policy-123');
      expect(result.rules).toHaveLength(2);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.privy.io/v1/policies');
      expect(opts.method).toBe('POST');
      expect(opts.headers.Authorization).toBe(expectedAuth);
      expect(opts.headers['privy-app-id']).toBe('test-app-id');
      expect(opts.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(opts.body);
      expect(body.name).toBe('Agent voting policy');
      expect(body.chain_type).toBe('solana');
      expect(body.rules).toHaveLength(2);
    });

    it('throws when Privy returns an error', async () => {
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      mockFetch.mockResolvedValueOnce(
        fakeResponse('Unauthorized', { ok: false, status: 401 }),
      );

      const { createPolicy } = await import('@shared/lib/privy-client');
      await expect(createPolicy()).rejects.toThrow('Failed to create Privy policy');
    });
  });

  // -----------------------------------------------------------------------
  // createAgentWallet
  // -----------------------------------------------------------------------
  describe('createAgentWallet', () => {
    it('sends correct POST and returns wallet id + address', async () => {
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      const expectedAuth =
        'Basic ' + Buffer.from('test-app-id:test-app-secret').toString('base64');

      const walletResponse = { id: 'wallet-abc', address: 'SolAddr123' };
      mockFetch.mockResolvedValueOnce(fakeResponse(walletResponse));

      const { createAgentWallet } = await import('@shared/lib/privy-client');
      const result = await createAgentWallet({
        policyIds: ['policy-123'],
        label: 'TestAgent Wallet',
      });

      expect(result).toEqual({ id: 'wallet-abc', address: 'SolAddr123' });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.privy.io/v1/wallets');
      expect(opts.method).toBe('POST');
      expect(opts.headers.Authorization).toBe(expectedAuth);

      const body = JSON.parse(opts.body);
      expect(body.chain_type).toBe('solana');
      expect(body.policy_ids).toEqual(['policy-123']);
      expect(body.label).toBe('TestAgent Wallet');
    });

    it('omits label when not provided', async () => {
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      mockFetch.mockResolvedValueOnce(fakeResponse({ id: 'w1', address: 'addr1' }));

      const { createAgentWallet } = await import('@shared/lib/privy-client');
      await createAgentWallet({ policyIds: ['p1'] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.label).toBeUndefined();
    });

    it('throws when Privy returns an error', async () => {
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      mockFetch.mockResolvedValueOnce(
        fakeResponse('Bad request', { ok: false, status: 400 }),
      );

      const { createAgentWallet } = await import('@shared/lib/privy-client');
      await expect(createAgentWallet({ policyIds: [] })).rejects.toThrow(
        'Failed to create Privy wallet',
      );
    });
  });

  // -----------------------------------------------------------------------
  // signAndSendTransaction
  // -----------------------------------------------------------------------
  describe('signAndSendTransaction', () => {
    it('sends correct RPC call and returns txHash', async () => {
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      const expectedAuth =
        'Basic ' + Buffer.from('test-app-id:test-app-secret').toString('base64');

      const rpcResponse = { hash: 'tx-hash-abc123' };
      mockFetch.mockResolvedValueOnce(fakeResponse(rpcResponse));

      const { signAndSendTransaction } = await import('@shared/lib/privy-client');
      const result = await signAndSendTransaction({
        walletId: 'wallet-abc',
        agentId: 'agent-1',
        serializedTransaction: 'base64EncodedTransactionData==',
      });

      expect(result.txHash).toBe('tx-hash-abc123');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.privy.io/v1/wallets/wallet-abc/rpc');
      expect(opts.method).toBe('POST');
      expect(opts.headers.Authorization).toBe(expectedAuth);

      const body = JSON.parse(opts.body);
      expect(body.method).toBe('solana_signAndSendTransaction');
      expect(body.params.transaction).toBe('base64EncodedTransactionData==');
      expect(body.params.encoding).toBe('base64');
    });

    it('rejects when serialized transaction is too short', async () => {
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      const { signAndSendTransaction } = await import('@shared/lib/privy-client');

      await expect(
        signAndSendTransaction({
          walletId: 'w1',
          agentId: 'a1',
          serializedTransaction: 'short',
        }),
      ).rejects.toThrow('Invalid serialized transaction');
    });

    it('throws when Privy RPC returns error', async () => {
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      mockFetch.mockResolvedValueOnce(
        fakeResponse('Policy violation', { ok: false, status: 403 }),
      );

      const { signAndSendTransaction } = await import('@shared/lib/privy-client');
      await expect(
        signAndSendTransaction({
          walletId: 'w1',
          agentId: 'a1',
          serializedTransaction: 'base64EncodedTransactionData==',
        }),
      ).rejects.toThrow('Privy signAndSendTransaction failed');
    });
  });

  // -----------------------------------------------------------------------
  // Rate limit enforcement
  // -----------------------------------------------------------------------
  describe('rate limit enforcement', () => {
    it('allows up to 5 transactions per hour per agent', async () => {
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      // Each call returns a valid response
      for (let i = 0; i < 6; i++) {
        mockFetch.mockResolvedValueOnce(fakeResponse({ hash: `tx-${i}` }));
      }

      const { signAndSendTransaction } = await import('@shared/lib/privy-client');
      const base64Tx = 'a]very-long-base64-transaction-string-for-testing';

      // First 5 should succeed
      for (let i = 0; i < 5; i++) {
        await signAndSendTransaction({
          walletId: 'w1',
          agentId: 'rate-test-agent',
          serializedTransaction: base64Tx,
        });
      }

      // 6th should throw rate limit error
      await expect(
        signAndSendTransaction({
          walletId: 'w1',
          agentId: 'rate-test-agent',
          serializedTransaction: base64Tx,
        }),
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('different agents have independent rate limits', async () => {
      process.env.PRIVY_APP_ID = 'test-app-id';
      process.env.PRIVY_APP_SECRET = 'test-app-secret';

      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce(fakeResponse({ hash: `tx-${i}` }));
      }

      const { signAndSendTransaction } = await import('@shared/lib/privy-client');
      const base64Tx = 'a]very-long-base64-transaction-string-for-testing';

      // 5 transactions for agent-A
      for (let i = 0; i < 5; i++) {
        await signAndSendTransaction({
          walletId: 'w1',
          agentId: 'agent-A-ratelimit',
          serializedTransaction: base64Tx,
        });
      }

      // Agent-B should still be able to transact
      await expect(
        signAndSendTransaction({
          walletId: 'w2',
          agentId: 'agent-B-ratelimit',
          serializedTransaction: base64Tx,
        }),
      ).resolves.toBeDefined();
    });
  });
});
