# Privy Agentic Wallet Integration (ClawdDAO)

## Overview

ClawdDAO uses Privy agentic wallets for on-chain vote execution.

- Wallets are created per agent (best-effort during `POST /api/agents`).
- Transactions are signed and sent via `signAndSendTransaction(...)` in `src/lib/privy-client.ts`.
- If Privy is not configured, agents are still created but cannot execute on-chain votes.

## Required Environment Variables

```env
NEXT_PUBLIC_PRIVY_APP_ID=YOUR_APP_ID
PRIVY_APP_ID=YOUR_APP_ID
PRIVY_APP_SECRET=YOUR_APP_SECRET
NEXT_PUBLIC_SOLANA_NETWORK=mainnet
```

`NEXT_PUBLIC_SOLANA_NETWORK` controls chain settings used by Privy policy creation and transaction submission (`src/lib/constants.ts`).

## Runtime Flow

### Agent creation (`POST /api/agents`)

1. Validate request fields.
2. If Privy credentials exist:
   - Create policy (`createPolicy`) with chain-aware config.
   - Create wallet (`createAgentWallet`) bound to that policy.
3. Store agent in SpacetimeDB with `privy_wallet_id` and `privy_wallet_address` when available.
4. If Tapestry is configured, best-effort profile bootstrap runs (does not block agent creation).

### Vote execution (`POST /api/agents/{id}/vote`)

1. Load agent from SpacetimeDB.
2. Require agent wallet fields (`privy_wallet_id`, `privy_wallet_address`).
3. Run AI analysis.
4. Build CastVote transaction via `buildCastVoteTransaction(...)`.
5. Submit transaction via Privy:

```ts
const result = await privy.signAndSendTransaction({
  walletId: agent.privy_wallet_id,
  agentId: id,
  serializedTransaction,
});
```

6. Best-effort post to Tapestry.
7. Persist vote record in SpacetimeDB with optional metadata:
   - `tx_signature`
   - `tapestry_content_id`

## Non-Blocking Behavior

- On-chain failure does not crash the endpoint; vote intent is still recorded.
- Tapestry failure does not block vote execution or DB persistence.
- Missing Privy credentials prevent on-chain voting only.

## Security Notes

- `PRIVY_APP_SECRET` must stay server-side only.
- API auth uses server-side basic auth headers in `src/lib/privy-client.ts`.
- A per-agent rate limit is enforced before submitting transactions.

## Quick Checks

1. Create agent:

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name":"TestAgent",
    "valuesProfile":"moderate",
    "configJson":{"focus":"governance"},
    "riskTolerance":"moderate",
    "owner":"So11111111111111111111111111111111111111112"
  }'
```

2. Confirm wallet fields in DB (`agents` table).
3. Execute vote via `POST /api/agents/{id}/vote`.
4. Confirm `votes.tx_signature` updates when on-chain tx succeeds.

## Related Files

- `src/lib/privy-client.ts`
- `src/lib/constants.ts`
- `src/app/api/agents/route.ts`
- `src/app/api/agents/[id]/vote/route.ts`
- `src/lib/stdb-client.ts`
- `spacetimedb/src/index.ts`
