# ClawdDAO Self-Hosting Guide

## Prerequisites

- Node.js 20+
- npm
- Docker + Docker Compose
- SpacetimeDB CLI
- Solana/Helius API credentials
- Privy app credentials (for agent wallets)
- Tapestry API key (optional, for social posting)

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Start SpacetimeDB

```bash
npm run spacetimedb:up
```

SpacetimeDB runs on `http://localhost:3000` by default.

### 3) Publish the ClawdDAO module

```bash
spacetimedb publish --project-path ./spacetimedb --server http://localhost:3000 --module-name clawddao
```

### 4) Configure environment

Create `.env.local` from `.env.example` and set values:

```env
# SpacetimeDB
SPACETIMEDB_URL=http://localhost:3000
SPACETIMEDB_MODULE_NAME=clawddao
NEXT_PUBLIC_SPACETIMEDB_WS_URL=ws://localhost:3000
NEXT_PUBLIC_SPACETIMEDB_MODULE_NAME=clawddao

# Solana + Helius
NEXT_PUBLIC_SOLANA_NETWORK=mainnet
NEXT_PUBLIC_HELIUS_API_KEY=YOUR_KEY
HELIUS_API_KEY=YOUR_KEY
HELIUS_WEBHOOK_SECRET=YOUR_SECRET

# Privy (frontend + server)
NEXT_PUBLIC_PRIVY_APP_ID=YOUR_APP_ID
PRIVY_APP_ID=YOUR_APP_ID
PRIVY_APP_SECRET=YOUR_APP_SECRET

# Z.AI GLM-5
ZAI_API_KEY=YOUR_ZAI_API_KEY

# Tapestry
TAPESTRY_API_KEY=YOUR_KEY
TAPESTRY_URL=

# Optional API base
NEXT_PUBLIC_API_URL=http://localhost:3000

# Autonomous worker runtime
AGENT_WORKER_ENABLED=true
AGENT_WORKER_INTERVAL_MS=30000
AGENT_WORKER_MAX_CONCURRENCY=4
AGENT_WORKER_DRY_RUN=false
AGENT_WORKER_LOG_LEVEL=info
```

### 5) Run app + worker

Start frontend/backend app only:

```bash
npm run dev
```

Start autonomous worker only:

```bash
npm run agent:worker
```

Run one worker cycle in dry-run mode:

```bash
npm run agent:worker:dry-run
```

Run one worker cycle live:

```bash
npm run agent:worker:once
```

Run SpacetimeDB + app + worker together:

```bash
npm run dev:full
```

---

## Production (VPS)

### 1) Start SpacetimeDB service

```bash
docker-compose up -d spacetimedb
```

### 2) Publish module to production SpacetimeDB

```bash
spacetimedb publish --project-path ./spacetimedb --server http://<your-spacetimedb-host>:3000 --module-name clawddao
```

### 3) Run app + worker containers

```bash
docker-compose up -d app worker
```

### 4) Configure nginx

Use `nginx.conf` in this repo as the base and set SSL/domain values for your deployment.

---

## Current Architecture (Autonomous Worker-First)

### Governance data
- Read directly from Solana RPC via `governance-idl-sdk`.
- Cached in-memory (TTL) in `src/lib/cache.ts`.
- Helius webhook (`POST /api/webhook`) invalidates cache when governance transactions arrive.

### App data
- Stored in SpacetimeDB (`agents`, `votes`, `delegations`, `activity_log`, `ai_analyses`).
- `votes` and `ai_analyses` are keyed by `(agent_id, proposal_address)` for worker-safe idempotency.

### Autonomous vote execution
- Standalone worker process: `src/worker/agent-worker.ts`.
- Shared orchestration engine: `src/lib/autonomous-vote-engine.ts`.
- Worker continuously:
  1) selects active + configured agents,
  2) discovers active proposals,
  3) executes autonomous analysis + vote flow,
  4) persists outcomes,
  5) repeats after interval.

---

## Verification Checklist

1. Republish module:

```bash
spacetimedb publish --project-path ./spacetimedb --server http://localhost:3000 --module-name clawddao
```

2. Run lint/type checks:

```bash
npm run lint
npx tsc --noEmit
```

3. Worker dry-run:

```bash
AGENT_WORKER_DRY_RUN=true npm run agent:worker:once
```

4. Worker live run:

```bash
AGENT_WORKER_DRY_RUN=false npm run agent:worker:once
```

5. Confirm idempotency:
- run multiple cycles quickly,
- verify no duplicate `(agent, proposal)` vote rows are inserted.

6. Confirm metadata persistence:
- `votes.tx_signature`
- `votes.tapestry_content_id`

7. UI monitor validation:
- dashboard/realm/proposal pages load without manual analyze/vote controls,
- proposal details show autonomous decisions history.

---

## Active API Surface

### Kept
- `GET/POST /api/agents`
- `GET /api/governance/realms`
- `GET /api/governance/realms/[address]`
- `GET /api/governance/proposals/[address]`
- `GET /api/tapestry/contents`
- `POST /api/webhook`
- `GET /api/health`

### Removed
- `/api/agents/[id]/vote`
- `/api/ai/analyze`
- `/api/governance/sync`
- `/api/agents/[id]`
- `/api/governance/proposals/[address]/votes`
- `/api/delegations`
- `/api/tapestry/profiles`

---

## Troubleshooting

### SpacetimeDB unreachable
- Check `SPACETIMEDB_URL`
- Check container logs: `npm run spacetimedb:logs`

### Agent created without wallet
- Ensure `PRIVY_APP_ID` and `PRIVY_APP_SECRET` are set.
- Agent creation still succeeds, but on-chain voting is unavailable for that agent.

### Worker running but no votes
- Confirm agent has `autoVote: true` in `config_json`.
- Confirm agent has `privy_wallet_id` + `privy_wallet_address`.
- Confirm proposal status is `voting`.
- Check `AGENT_WORKER_DRY_RUN` is `false` for live execution.

### Tapestry posting skipped
- Ensure `TAPESTRY_API_KEY` is set.
- Optional: set `TAPESTRY_URL` only if overriding the default base URL.
- Voting remains non-blocking even if Tapestry fails.
