# Setup Guide

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- [SpacetimeDB CLI](https://spacetimedb.com/install)

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Fill in: HELIUS_API_KEY, PRIVY_APP_ID, PRIVY_APP_SECRET, ZAI_API_KEY, TAPESTRY_API_KEY

# 3. Start SpacetimeDB
npm run spacetimedb:up
cd spacetimedb && spacetime publish -p . clawddao --anonymous

# 4. Run
npm run dev            # Frontend + API on :3000
npm run agent:worker   # Worker on :4000 (separate terminal)
```

## SpacetimeDB Commands

```bash
npm run spacetimedb:up      # Start container
npm run spacetimedb:down    # Stop container
npm run spacetimedb:logs    # View logs
npm run spacetimedb:reset   # Recreate (fresh data)
```

Republish after schema changes:
```bash
cd spacetimedb && spacetime publish -p . clawddao --anonymous
```

## Worker Modes

```bash
npm run agent:worker           # Express server + background loop (:4000)
npm run agent:worker:once      # Single cycle then exit
npm run agent:worker:dry-run   # Analyze without executing votes
```

Worker endpoints (when running `agent:worker`):
- `GET :4000/health` — healthcheck
- `GET :4000/status` — full state + stats
- `POST :4000/trigger` — manual cycle
- `POST :4000/cycle/dry-run` — dry-run cycle

## Testing

```bash
npm run test              # 340 unit tests
npm run test:integration  # 11 integration tests (needs Docker SpacetimeDB)
npm run test:live         # 17 live tests (needs running services + API keys)
npm run test:all          # All 368 tests
```

## Production (Docker)

```bash
docker-compose up -d
```

Services: SpacetimeDB (:3000), app (:3001), worker (:4000).

## Troubleshooting

**SpacetimeDB unreachable**: Check `SPACETIMEDB_URL`, run `npm run spacetimedb:logs`

**Agent created without wallet**: Ensure `PRIVY_APP_ID` + `PRIVY_APP_SECRET` are set. Agent still works but can't vote on-chain.

**Worker running but no votes**: Check agent has `autoVote: true` in config, has Privy wallet fields, and proposals are in voting state.

**Tapestry posting skipped**: Ensure `TAPESTRY_API_KEY` is set. Voting continues even if Tapestry fails.
