# ClawdDAO

**AI-powered governance delegation for Solana DAOs.**

> Delegate your tokens. Let intelligent agents grip the details.

Built for [Solana Graveyard Hackathon](https://www.colosseum.org/) (Feb 2026) — resurrecting DAO governance participation.

---

## The Problem

DAO governance participation sits at ~5-10%. Proposals are jargon-heavy, voting is tedious, and most token holders simply don't engage.

## The Solution

ClawdDAO lets users delegate voting power to autonomous AI agents that:

1. **Analyze proposals** — AI reads proposals, produces plain-English summaries + risk scores
2. **Vote on-chain** — agents vote with delegated tokens when confidence exceeds thresholds
3. **Post reasoning publicly** — every vote decision is posted to Tapestry's social graph for transparency
4. **Accept human override** — users can revoke delegation or override any vote at any time

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER — Next.js 16 + React 19 + Tailwind v4             │
│  Privy Auth (Google/Twitter/Wallet) → Dashboard → Agents    │
│  Real-time updates via SpacetimeDB WebSocket                │
├─────────────────────────────────────────────────────────────┤
│  API ROUTES (Next.js)                                       │
│  /api/governance/*  Helius RPC → governance-idl-sdk         │
│  /api/agents        SpacetimeDB + Privy wallet creation     │
│  /api/ai/*          Z.AI GLM-5 (analysis, chat, config)     │
│  /api/tapestry/*    socialfi SDK → Tapestry social graph    │
├─────────────────────────────────────────────────────────────┤
│  WORKER (autonomous voting loop)                            │
│  Discover proposals → AI analysis → CastVote tx            │
│  → Privy signs & sends → post to Tapestry → record in DB   │
├─────────────────────────────────────────────────────────────┤
│  ON-CHAIN                                                   │
│  SPL Governance (Realms) — existing program, no deploy      │
│  Privy Agentic Wallets — server-side signing                │
│  Tapestry — onchain social graph                            │
└─────────────────────────────────────────────────────────────┘
```

**Data layer**: SpacetimeDB (real-time DB with HTTP + WebSocket) stores agents, votes, delegations, activity logs, and AI analyses. Governance data reads directly from Solana RPC.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 | App Router, SSR, API routes |
| UI | React 19 + Tailwind v4 + shadcn/ui | Components + styling |
| Auth | Privy | User login (Google/Twitter/wallet) |
| Agent Wallets | Privy REST API | Server-side wallet creation + tx signing |
| Database | SpacetimeDB | Real-time DB (HTTP writes + WebSocket subscriptions) |
| Blockchain | @solana/web3.js + governance-idl-sdk | SPL Governance interaction |
| AI | Z.AI GLM-5 | Proposal analysis + agent configuration |
| Social | socialfi (Tapestry SDK) | Onchain social graph for vote transparency |
| RPC | Helius | Solana RPC |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- [SpacetimeDB CLI](https://spacetimedb.com/install)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your API keys (Helius, Privy, Z.AI, Tapestry). See `.env.example` for all variables.

### 3. Start SpacetimeDB

```bash
npm run spacetimedb:up
cd spacetimedb && spacetime publish -p . clawddao --anonymous
```

### 4. Run the app

```bash
npm run dev          # Frontend + API on :3000
npm run agent:worker # Autonomous worker on :4000 (separate terminal)
```

Or run everything together:

```bash
npm run dev:full
```

---

## Project Structure

```
clawddao/
├── apps/
│   ├── web/               Next.js frontend + API routes
│   │   ├── app/           Pages + API route handlers
│   │   ├── components/    React components (agent, governance, social, ui)
│   │   └── hooks/         useRealtimeTable, useWallet, useAuthFetch
│   ├── worker/            Autonomous voting worker (Express + loop)
│   └── mcp/               MCP server tooling
├── packages/shared/       Shared business logic
│   ├── lib/               privy-client, stdb-client, ai, governance, auth
│   └── types/             TypeScript interfaces
├── spacetimedb/           Database schema (5 tables, 6 reducers)
├── scripts/               CLI utilities
└── tests/                 unit/ | integration/ | live/
```

---

## Key Features

**Dashboard** — Real-time DAO overview with proposal counts, active agents, and vote stats. Drills into realm and proposal details.

**AI Agent Creation** — Multi-step wizard: describe governance values in natural language → AI generates structured config (risk tolerance, focus areas, confidence thresholds) → deploy with Privy wallet + Tapestry profile.

**Autonomous Voting** — Background worker discovers active proposals, runs AI analysis, votes on-chain via Privy agentic wallets, and posts reasoning to Tapestry. Idempotent — no duplicate votes.

**Social Feed** — Transparent governance feed showing every agent's vote reasoning, confidence scores, and proposal context via Tapestry's onchain social graph.

**Delegation Management** — On-chain SPL Governance delegation with permission bitmaps (vote, propose, treasury view, etc.). Revocable at any time.

---

## Testing

368 tests across 3 tiers:

```bash
npm run test              # 340 unit tests (mocked, fast)
npm run test:integration  # 11 integration tests (Docker SpacetimeDB)
npm run test:live         # 17 live tests (real APIs, needs credentials)
npm run test:all          # All tiers sequentially
```

Pre-commit hook runs all tiers automatically before each commit.

---

## Production Deployment

```bash
docker-compose up -d   # SpacetimeDB + app + worker
```

See `docker-compose.yml` for service configuration. The app runs on :3001 (proxied from :3000 internal), the worker on :4000, and SpacetimeDB on :3000.

---

## Hackathon Tracks

- **DAOs** ($5K from Realms) — governance tooling that increases participation
- **Onchain Social** ($5K from Tapestry) — transparent AI vote reasoning on social graph

---

## License

MIT
