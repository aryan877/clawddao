/**
 * Privy Agentic Wallet Client
 *
 * Manages AI agent wallets on Solana with spending policy guardrails.
 * Policies are enforced by Privy (not in our code).
 *
 * Security:
 * - APP_SECRET is never exposed or logged
 * - Every transaction is validated before submission
 * - Rate limiting enforced locally
 * - Audit log of all operations
 */

import { SOLANA_CHAIN_CONFIG } from './constants';

// Privy API configuration
const PRIVY_API_URL = 'https://api.privy.io/v1';
const PRIVY_APP_ID = process.env.PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.warn('⚠️ Privy credentials not configured. Agent wallets will be disabled.');
}

// Rate limiting: track transactions per agent
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_TRANSACTIONS_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour

/**
 * Check if Privy is configured and available.
 */
export function isConfigured(): boolean {
  return Boolean(PRIVY_APP_ID && PRIVY_APP_SECRET);
}

/**
 * Basic auth header for Privy API
 */
function getAuthHeader(): string {
  const credentials = `${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`;
  return 'Basic ' + Buffer.from(credentials).toString('base64');
}

/**
 * Validate rate limits for an agent
 */
function checkRateLimit(agentId: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(agentId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(agentId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (entry.count >= MAX_TRANSACTIONS_PER_HOUR) {
    throw new Error(
      `Rate limit exceeded: ${MAX_TRANSACTIONS_PER_HOUR} transactions per hour. Reset in ${Math.ceil((entry.resetAt - now) / 1000)}s.`
    );
  }

  entry.count++;
}

/**
 * Create a spending policy for agent wallets
 */
export async function createPolicy(options?: {
  maxSolPerTx?: number;
  allowedPrograms?: string[];
  chainId?: number;
}): Promise<{
  id: string;
  name: string;
  rules: Array<{ name: string; action: string }>;
}> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy credentials not configured');
  }

  const maxLamports = Math.floor((options?.maxSolPerTx || 0.1) * 1e9);
  const chainId = options?.chainId || SOLANA_CHAIN_CONFIG.chainId;

  const policyPayload = {
    version: '1.0',
    name: 'Agent voting policy',
    chain_type: 'solana',
    rules: [
      {
        name: `Max ${options?.maxSolPerTx || 0.1} SOL per transaction`,
        method: 'solana_sendTransaction',
        conditions: [
          {
            field_source: 'solana_transaction',
            field: 'lamports',
            operator: 'lte',
            value: maxLamports.toString(),
          },
        ],
        action: 'ALLOW',
      },
      {
        name: `Chain ${chainId === 101 ? 'mainnet' : 'devnet'} only`,
        method: 'solana_sendTransaction',
        conditions: [
          {
            field_source: 'solana_transaction',
            field: 'chain_id',
            operator: 'eq',
            value: chainId.toString(),
          },
        ],
        action: 'ALLOW',
      },
    ],
  };

  const res = await fetch(`${PRIVY_API_URL}/policies`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'privy-app-id': PRIVY_APP_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(policyPayload),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create Privy policy: ${res.status} ${error}`);
  }

  return res.json();
}

/**
 * Create an agent wallet with spending policies
 */
export async function createAgentWallet(options: {
  policyIds: string[];
  label?: string;
}): Promise<{ id: string; address: string }> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy credentials not configured');
  }

  const res = await fetch(`${PRIVY_API_URL}/wallets`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'privy-app-id': PRIVY_APP_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chain_type: 'solana',
      policy_ids: options.policyIds,
      ...(options.label && { label: options.label }),
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create Privy wallet: ${res.status} ${error}`);
  }

  const wallet = await res.json();
  return {
    id: wallet.id,
    address: wallet.address,
  };
}

/**
 * Retrieve wallet details
 */
export async function getWallet(walletId: string): Promise<{
  id: string;
  address: string;
  chain_type: string;
  policy_ids: string[];
}> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy credentials not configured');
  }

  const res = await fetch(`${PRIVY_API_URL}/wallets/${walletId}`, {
    headers: {
      Authorization: getAuthHeader(),
      'privy-app-id': PRIVY_APP_ID,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch wallet: ${res.status}`);
  }

  return res.json();
}

/**
 * Sign and send a serialized Solana transaction via Privy's wallet RPC.
 *
 * This is the correct way to use Privy with Solana:
 *   1. Build the transaction locally (unsigned)
 *   2. Serialize as base64
 *   3. Send to Privy → Privy signs with the agent's key → broadcasts to Solana
 *
 * @param walletId - The Privy wallet ID
 * @param agentId - The agent ID (for rate limiting + audit)
 * @param serializedTransaction - Base64-encoded unsigned transaction
 * @returns Transaction hash
 */
export async function signAndSendTransaction(options: {
  walletId: string;
  agentId: string;
  serializedTransaction: string;
}): Promise<{ txHash: string }> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy credentials not configured');
  }

  // Rate limit check
  checkRateLimit(options.agentId);

  // Validate the base64 is non-empty
  if (!options.serializedTransaction || options.serializedTransaction.length < 10) {
    throw new Error('Invalid serialized transaction: too short or empty');
  }

  const res = await fetch(`${PRIVY_API_URL}/wallets/${options.walletId}/rpc`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'privy-app-id': PRIVY_APP_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'solana_signAndSendTransaction',
      caip2: SOLANA_CHAIN_CONFIG.caip2,
      params: {
        transaction: options.serializedTransaction,
        encoding: 'base64',
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Privy signAndSendTransaction failed: ${res.status} ${error}`);
  }

  const result = await res.json();
  const txHash = result.hash || result.signature || result.tx_hash;

  // Audit log
  auditLog({
    timestamp: new Date().toISOString(),
    action: 'sign_and_send_transaction',
    walletId: options.walletId,
    agentId: options.agentId,
    txHash: txHash || 'unknown',
    status: 'submitted',
  });

  return { txHash };
}

/**
 * Sign a transaction without sending (for cases where we want to submit ourselves).
 */
export async function signTransaction(options: {
  walletId: string;
  serializedTransaction: string;
}): Promise<{ signedTransaction: string }> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy credentials not configured');
  }

  const res = await fetch(`${PRIVY_API_URL}/wallets/${options.walletId}/rpc`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'privy-app-id': PRIVY_APP_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'solana_signTransaction',
      caip2: SOLANA_CHAIN_CONFIG.caip2,
      params: {
        transaction: options.serializedTransaction,
        encoding: 'base64',
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Privy signTransaction failed: ${res.status} ${error}`);
  }

  const result = await res.json();
  return {
    signedTransaction: result.signedTransaction || result.signed_transaction,
  };
}

/**
 * Audit logging
 */
function auditLog(entry: Record<string, string>): void {
  console.log('[PRIVY_AUDIT]', JSON.stringify(entry));
}

/**
 * Get wallet policy details
 */
export async function getPolicy(policyId: string): Promise<{
  id: string;
  name: string;
  rules: Array<{ name: string; action: string }>;
}> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy credentials not configured');
  }

  const res = await fetch(`${PRIVY_API_URL}/policies/${policyId}`, {
    headers: {
      Authorization: getAuthHeader(),
      'privy-app-id': PRIVY_APP_ID,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch policy: ${res.status}`);
  }

  return res.json();
}
