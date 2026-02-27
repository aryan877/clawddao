import { describe, it, expect } from 'vitest';
import { isAgentEligibleForAutonomy } from '@shared/lib/autonomous-vote-engine';
import type { AgentRow } from '@shared/lib/stdb-client';

function makeAgentRow(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: BigInt(1),
    owner_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    name: 'Test Agent',
    values_profile: 'Conservative governance, focus on security',
    config_json: JSON.stringify({
      autoVote: true,
      confidenceThreshold: 0.7,
      values: ['transparency', 'security'],
      focusAreas: ['treasury'],
    }),
    risk_tolerance: 'moderate',
    is_active: true,
    privy_wallet_id: 'wallet-id-abc',
    privy_wallet_address: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    total_votes: 5,
    accuracy_score: 0.85,
    delegation_count: 2,
    created_at: 1706745600,
    updated_at: 1706745600,
    ...overrides,
  };
}

describe('isAgentEligibleForAutonomy()', () => {
  // -------------------------------------------------------------------------
  // Eligible: active + wallet + autoVote — all three required
  // -------------------------------------------------------------------------
  it('returns true for active agent with wallet and autoVote enabled', () => {
    const agent = makeAgentRow();
    expect(isAgentEligibleForAutonomy(agent)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Inactive agent
  // -------------------------------------------------------------------------
  it('returns false when agent is inactive', () => {
    const agent = makeAgentRow({ is_active: false });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Missing wallet (privy_wallet_id)
  // -------------------------------------------------------------------------
  it('returns false when privy_wallet_id is null', () => {
    const agent = makeAgentRow({ privy_wallet_id: null });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  it('returns false when privy_wallet_id is empty string', () => {
    const agent = makeAgentRow({ privy_wallet_id: '' });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Missing wallet (privy_wallet_address)
  // -------------------------------------------------------------------------
  it('returns false when privy_wallet_address is null', () => {
    const agent = makeAgentRow({ privy_wallet_address: null });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  it('returns false when privy_wallet_address is empty string', () => {
    const agent = makeAgentRow({ privy_wallet_address: '' });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Both wallet fields missing
  // -------------------------------------------------------------------------
  it('returns false when both wallet fields are null', () => {
    const agent = makeAgentRow({
      privy_wallet_id: null,
      privy_wallet_address: null,
    });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // autoVote disabled in config
  // -------------------------------------------------------------------------
  it('returns false when autoVote is false in config_json', () => {
    const agent = makeAgentRow({
      config_json: JSON.stringify({
        autoVote: false,
        confidenceThreshold: 0.7,
        values: [],
        focusAreas: [],
      }),
    });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  it('returns false when autoVote is not present in config_json', () => {
    const agent = makeAgentRow({
      config_json: JSON.stringify({
        confidenceThreshold: 0.7,
        values: [],
        focusAreas: [],
      }),
    });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Invalid/malformed config_json
  // -------------------------------------------------------------------------
  it('returns false when config_json is invalid JSON', () => {
    const agent = makeAgentRow({
      config_json: 'not valid json {{{',
    });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  it('returns false when config_json is empty string', () => {
    const agent = makeAgentRow({
      config_json: '',
    });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Edge cases: all three conditions must be true simultaneously
  // -------------------------------------------------------------------------
  it('returns false when active + autoVote but missing wallet', () => {
    const agent = makeAgentRow({
      is_active: true,
      privy_wallet_id: null,
      privy_wallet_address: null,
      config_json: JSON.stringify({ autoVote: true }),
    });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  it('returns false when active + wallet but autoVote disabled', () => {
    const agent = makeAgentRow({
      is_active: true,
      config_json: JSON.stringify({ autoVote: false }),
    });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });

  it('returns false when wallet + autoVote but inactive', () => {
    const agent = makeAgentRow({
      is_active: false,
      config_json: JSON.stringify({ autoVote: true }),
    });
    expect(isAgentEligibleForAutonomy(agent)).toBe(false);
  });
});
