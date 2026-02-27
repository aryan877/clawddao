# Privy Integration

## Overview

ClawdDAO uses Privy for two things:
1. **User auth** (frontend) — `@privy-io/react-auth` for Google/Twitter/wallet login
2. **Agent wallets** (server) — REST API for creating wallets, signing + sending transactions

## Required Environment Variables

```env
NEXT_PUBLIC_PRIVY_APP_ID=YOUR_APP_ID    # Frontend auth
PRIVY_APP_ID=YOUR_APP_ID                # Server-side
PRIVY_APP_SECRET=YOUR_APP_SECRET        # Server-side (never expose to client)
NEXT_PUBLIC_SOLANA_NETWORK=devnet       # Controls CAIP-2 chain in policies
```

## Agent Wallet Flow

**Agent creation** (`POST /api/agents`):
1. Create spending policy via `createPolicy()` — max SOL per tx, allowed programs
2. Create Solana wallet via `createAgentWallet()` — bound to that policy
3. Store `privy_wallet_id` + `privy_wallet_address` in SpacetimeDB

**Vote execution** (worker or `POST /api/agents/{id}/vote`):
1. Build CastVote tx locally (unsigned, base64)
2. Send to Privy via `signAndSendTransaction()` — Privy signs with agent key and broadcasts
3. Record tx_signature in SpacetimeDB

## Security

- `PRIVY_APP_SECRET` is server-only — used in Basic auth header
- Rate limit: 5 transactions per hour per agent (enforced in privy-client.ts)
- Spending policies enforced by Privy (max lamports per tx)
- Missing Privy credentials → agents created but cannot vote on-chain

## Key Files

- `packages/shared/lib/privy-client.ts` — all Privy REST API calls
- `packages/shared/lib/constants.ts` — CAIP-2 chain IDs per network
- `packages/shared/lib/auth.ts` — Privy JWT verification for API routes
