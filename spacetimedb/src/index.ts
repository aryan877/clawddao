// SpacetimeDB Server Module — ClawdDAO
// This module stores APP-GENERATED data only (agents, votes, delegations, activity).
// Governance data (realms, proposals) is read directly from Solana RPC — not mirrored here.
// Deploy with: spacetime publish clawddao -p spacetimedb/

import { schema, table, t } from 'spacetimedb/server';

// ─── TABLES ───

const agents = table(
  { name: 'agents', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    owner_wallet: t.string().index('btree'),
    name: t.string(),
    values_profile: t.string(),
    config_json: t.string(),
    risk_tolerance: t.string(),
    is_active: t.bool(),
    privy_wallet_id: t.option(t.string()),
    privy_wallet_address: t.option(t.string()),
    total_votes: t.u32(),
    accuracy_score: t.u32(),
    delegation_count: t.u32(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const votes = table(
  { name: 'votes', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    vote_key: t.string().unique(),
    agent_id: t.u64().index('btree'),
    proposal_address: t.string().index('btree'),
    vote: t.string(),
    reasoning: t.string(),
    confidence: t.f64(),
    tx_signature: t.option(t.string()),
    tapestry_content_id: t.option(t.string()),
    created_at: t.timestamp(),
  }
);

const delegations = table(
  { name: 'delegations', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    delegator_wallet: t.string().index('btree'),
    agent_id: t.u64().index('btree'),
    realm_address: t.string(),
    scope_bitmap: t.u64(),
    is_active: t.bool(),
    on_chain_pda: t.option(t.string()),
    created_at: t.timestamp(),
  }
);

const activity_log = table(
  { name: 'activity_log', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    agent_id: t.u64().index('btree'),
    action_type: t.string(),
    description: t.string(),
    metadata_json: t.option(t.string()),
    created_at: t.timestamp(),
  }
);

const tracked_realms = table(
  { name: 'tracked_realms', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    address: t.string().unique(),
    name: t.string(),
    is_active: t.bool(),
    added_at: t.timestamp(),
  }
);

const ai_analyses = table(
  { name: 'ai_analyses', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    analysis_key: t.string().unique(),
    agent_id: t.u64().index('btree'),
    proposal_address: t.string().index('btree'),
    analysis_json: t.string(),
    recommendation: t.string(),
    confidence: t.f64(),
    created_at: t.timestamp(),
  }
);

// ─── SCHEMA ───

const spacetimedb = schema(
  agents,
  votes,
  delegations,
  activity_log,
  ai_analyses,
  tracked_realms
);

export default spacetimedb;

// ─── REDUCERS ───

export const create_agent = spacetimedb.reducer(
  'create_agent',
  {
    name: t.string(),
    values_profile: t.string(),
    config_json: t.string(),
    risk_tolerance: t.string(),
    owner_wallet: t.string(),
    privy_wallet_id: t.option(t.string()),
    privy_wallet_address: t.option(t.string()),
  },
  (ctx, args) => {
    ctx.db.agents.insert({
      id: 0n,
      owner_wallet: args.owner_wallet,
      name: args.name,
      values_profile: args.values_profile,
      config_json: args.config_json,
      risk_tolerance: args.risk_tolerance,
      is_active: true,
      privy_wallet_id: args.privy_wallet_id,
      privy_wallet_address: args.privy_wallet_address,
      total_votes: 0,
      accuracy_score: 0,
      delegation_count: 0,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  }
);

export const update_agent = spacetimedb.reducer(
  'update_agent',
  {
    agent_id: t.u64(),
    name: t.option(t.string()),
    config_json: t.option(t.string()),
    is_active: t.option(t.bool()),
  },
  (ctx, args) => {
    const agent = ctx.db.agents.id.find(args.agent_id);
    if (!agent) throw new Error('Agent not found');

    ctx.db.agents.id.update({
      ...agent,
      name: args.name ?? agent.name,
      config_json: args.config_json ?? agent.config_json,
      is_active: args.is_active ?? agent.is_active,
      updated_at: ctx.timestamp,
    });
  }
);

export const record_vote = spacetimedb.reducer(
  'record_vote',
  {
    agent_id: t.u64(),
    proposal_address: t.string(),
    vote: t.string(),
    reasoning: t.string(),
    confidence: t.f64(),
    tx_signature: t.option(t.string()),
    tapestry_content_id: t.option(t.string()),
  },
  (ctx, args) => {
    const voteKey = `${args.agent_id.toString()}:${args.proposal_address}`;
    const existing = ctx.db.votes.vote_key.find(voteKey);

    // Idempotent guard for autonomous worker loops.
    if (existing) {
      const mergedTx = existing.tx_signature ?? args.tx_signature;
      const mergedTapestry = existing.tapestry_content_id ?? args.tapestry_content_id;

      if (mergedTx !== existing.tx_signature || mergedTapestry !== existing.tapestry_content_id) {
        ctx.db.votes.vote_key.update({
          ...existing,
          tx_signature: mergedTx,
          tapestry_content_id: mergedTapestry,
        });
      }
      return;
    }

    ctx.db.votes.insert({
      id: 0n,
      vote_key: voteKey,
      agent_id: args.agent_id,
      proposal_address: args.proposal_address,
      vote: args.vote,
      reasoning: args.reasoning,
      confidence: args.confidence,
      tx_signature: args.tx_signature,
      tapestry_content_id: args.tapestry_content_id,
      created_at: ctx.timestamp,
    });

    // Update agent vote count
    const agent = ctx.db.agents.id.find(args.agent_id);
    if (agent) {
      ctx.db.agents.id.update({
        ...agent,
        total_votes: agent.total_votes + 1,
        updated_at: ctx.timestamp,
      });
    }

    // Log activity
    ctx.db.activityLog.insert({
      id: 0n,
      agent_id: args.agent_id,
      action_type: 'vote',
      description: `Voted ${args.vote.toUpperCase()} on proposal ${args.proposal_address.slice(0, 8)}...`,
      metadata_json: JSON.stringify({ proposal: args.proposal_address, confidence: args.confidence }),
      created_at: ctx.timestamp,
    });
  }
);

export const create_delegation = spacetimedb.reducer(
  'create_delegation',
  {
    agent_id: t.u64(),
    realm_address: t.string(),
    scope_bitmap: t.u64(),
    delegator_wallet: t.string(),
  },
  (ctx, args) => {
    ctx.db.delegations.insert({
      id: 0n,
      delegator_wallet: args.delegator_wallet,
      agent_id: args.agent_id,
      realm_address: args.realm_address,
      scope_bitmap: args.scope_bitmap,
      is_active: true,
      on_chain_pda: undefined,
      created_at: ctx.timestamp,
    });

    // Update agent delegation count
    const agent = ctx.db.agents.id.find(args.agent_id);
    if (agent) {
      ctx.db.agents.id.update({
        ...agent,
        delegation_count: agent.delegation_count + 1,
        updated_at: ctx.timestamp,
      });
    }

    ctx.db.activityLog.insert({
      id: 0n,
      agent_id: args.agent_id,
      action_type: 'delegate',
      description: `Received delegation from ${args.delegator_wallet.slice(0, 8)}... for realm ${args.realm_address.slice(0, 8)}...`,
      metadata_json: JSON.stringify({ realm: args.realm_address, scope: args.scope_bitmap.toString() }),
      created_at: ctx.timestamp,
    });
  }
);

export const revoke_delegation = spacetimedb.reducer(
  'revoke_delegation',
  { delegation_id: t.u64() },
  (ctx, args) => {
    const delegation = ctx.db.delegations.id.find(args.delegation_id);
    if (!delegation) throw new Error('Delegation not found');

    ctx.db.delegations.id.update({
      ...delegation,
      is_active: false,
    });

    const agent = ctx.db.agents.id.find(delegation.agent_id);
    if (agent && agent.delegation_count > 0) {
      ctx.db.agents.id.update({
        ...agent,
        delegation_count: agent.delegation_count - 1,
        updated_at: ctx.timestamp,
      });
    }
  }
);

export const store_ai_analysis = spacetimedb.reducer(
  'store_ai_analysis',
  {
    agent_id: t.u64(),
    proposal_address: t.string(),
    analysis_json: t.string(),
    recommendation: t.string(),
    confidence: t.f64(),
  },
  (ctx, args) => {
    const analysisKey = `${args.agent_id.toString()}:${args.proposal_address}`;
    const existing = ctx.db.aiAnalyses.analysis_key.find(analysisKey);

    if (existing) {
      ctx.db.aiAnalyses.analysis_key.update({
        ...existing,
        analysis_json: args.analysis_json,
        recommendation: args.recommendation,
        confidence: args.confidence,
      });
      return;
    }

    ctx.db.aiAnalyses.insert({
      id: 0n,
      analysis_key: analysisKey,
      agent_id: args.agent_id,
      proposal_address: args.proposal_address,
      analysis_json: args.analysis_json,
      recommendation: args.recommendation,
      confidence: args.confidence,
      created_at: ctx.timestamp,
    });
  }
);

export const update_agent_wallet = spacetimedb.reducer(
  'update_agent_wallet',
  {
    agent_id: t.u64(),
    privy_wallet_id: t.string(),
    privy_wallet_address: t.string(),
  },
  (ctx, args) => {
    const agent = ctx.db.agents.id.find(args.agent_id);
    if (!agent) throw new Error('Agent not found');

    ctx.db.agents.id.update({
      ...agent,
      privy_wallet_id: args.privy_wallet_id,
      privy_wallet_address: args.privy_wallet_address,
      updated_at: ctx.timestamp,
    });
  }
);

export const add_tracked_realm = spacetimedb.reducer(
  'add_tracked_realm',
  {
    address: t.string(),
    name: t.string(),
  },
  (ctx, args) => {
    const existing = ctx.db.trackedRealms.address.find(args.address);
    if (existing) return;

    ctx.db.trackedRealms.insert({
      id: 0n,
      address: args.address,
      name: args.name,
      is_active: true,
      added_at: ctx.timestamp,
    });
  }
);

export const remove_tracked_realm = spacetimedb.reducer(
  'remove_tracked_realm',
  { address: t.string() },
  (ctx, args) => {
    const realm = ctx.db.trackedRealms.address.find(args.address);
    if (!realm) return;
    ctx.db.trackedRealms.address.delete(args.address);
  }
);

export const clear_all_votes = spacetimedb.reducer(
  'clear_all_votes',
  {},
  (ctx) => {
    // Delete all votes
    const voteIds: bigint[] = [];
    for (const vote of ctx.db.votes.iter()) {
      voteIds.push(vote.id);
    }
    for (const id of voteIds) {
      ctx.db.votes.id.delete(id);
    }

    // Reset agent total_votes to 0
    const agentUpdates: { id: bigint }[] = [];
    for (const agent of ctx.db.agents.iter()) {
      agentUpdates.push({ id: agent.id });
    }
    for (const { id } of agentUpdates) {
      const agent = ctx.db.agents.id.find(id);
      if (agent) {
        ctx.db.agents.id.update({
          ...agent,
          total_votes: 0,
          updated_at: ctx.timestamp,
        });
      }
    }

    // Clear AI analyses too (stale from previous run)
    const analysisIds: bigint[] = [];
    for (const analysis of ctx.db.aiAnalyses.iter()) {
      analysisIds.push(analysis.id);
    }
    for (const id of analysisIds) {
      ctx.db.aiAnalyses.id.delete(id);
    }
  }
);

export const seed_tracked_realms = spacetimedb.reducer(
  'seed_tracked_realms',
  {},
  (ctx) => {
    // Devnet test realm (created via scripts/setup-devnet-realm.ts)
    // For mainnet, replace with real realm addresses (Marinade, Mango, Jito, etc.)
    const defaults = [
      { address: 'j3JUuwBzzh1VHcE8gskSXbjjemK4kxZjvnvWfBLrRdk', name: 'ClawdDAO-Test' },
    ];

    for (const realm of defaults) {
      const existing = ctx.db.trackedRealms.address.find(realm.address);
      if (existing) continue;

      ctx.db.trackedRealms.insert({
        id: 0n,
        address: realm.address,
        name: realm.name,
        is_active: true,
        added_at: ctx.timestamp,
      });
    }
  }
);
