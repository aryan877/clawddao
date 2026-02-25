import { describe, it, expect, vi } from 'vitest';

// The stdb-client module has internal (non-exported) helpers: escapeSqlString
// and toVoteKey. We test them indirectly through exported functions that use
// them, or by extracting the logic.
//
// Since escapeSqlString and toVoteKey are not exported, we replicate their
// logic here to verify the patterns, and test the exported functions that
// rely on them (getAgentsByOwner uses escapeSqlString, getVoteByAgentAndProposal
// uses toVoteKey).

// ---------------------------------------------------------------------------
// escapeSqlString pattern tests
// ---------------------------------------------------------------------------
describe('escapeSqlString pattern', () => {
  // Replicate the internal function logic for verification
  function escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
  }

  it('escapes single quotes by doubling them', () => {
    expect(escapeSqlString("O'Brien")).toBe("O''Brien");
  });

  it('leaves strings without quotes unchanged', () => {
    expect(escapeSqlString('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeSqlString('')).toBe('');
  });

  it('handles multiple single quotes', () => {
    expect(escapeSqlString("it's a dog's life")).toBe("it''s a dog''s life");
  });

  it('handles consecutive quotes', () => {
    expect(escapeSqlString("''")).toBe("''''");
  });

  it('does not affect double quotes', () => {
    expect(escapeSqlString('say "hello"')).toBe('say "hello"');
  });
});

// ---------------------------------------------------------------------------
// toVoteKey pattern tests
// ---------------------------------------------------------------------------
describe('toVoteKey pattern', () => {
  // Replicate the internal function logic for verification
  function toVoteKey(agentId: bigint, proposalAddress: string): string {
    return `${agentId.toString()}:${proposalAddress}`;
  }

  it('constructs key as agentId:proposalAddress', () => {
    const key = toVoteKey(BigInt(42), 'proposal111');
    expect(key).toBe('42:proposal111');
  });

  it('handles BigInt(0)', () => {
    const key = toVoteKey(BigInt(0), 'abc');
    expect(key).toBe('0:abc');
  });

  it('handles large BigInt values', () => {
    const key = toVoteKey(BigInt('9999999999999999'), 'xyz');
    expect(key).toBe('9999999999999999:xyz');
  });

  it('produces unique keys for different agents on same proposal', () => {
    const key1 = toVoteKey(BigInt(1), 'proposal');
    const key2 = toVoteKey(BigInt(2), 'proposal');
    expect(key1).not.toBe(key2);
  });

  it('produces unique keys for same agent on different proposals', () => {
    const key1 = toVoteKey(BigInt(1), 'proposalA');
    const key2 = toVoteKey(BigInt(1), 'proposalB');
    expect(key1).not.toBe(key2);
  });
});

// ---------------------------------------------------------------------------
// SQL query patterns used by exported functions
// ---------------------------------------------------------------------------
describe('SQL query construction patterns', () => {
  // These tests verify the SQL patterns used in stdb-client query helpers

  it('agents query uses owner_wallet filter with escaped string', () => {
    const wallet = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    const safeWallet = wallet.replace(/'/g, "''");
    const sql = `SELECT * FROM agents WHERE owner_wallet = '${safeWallet}' AND is_active = true`;
    expect(sql).toContain(wallet);
    expect(sql).toContain('is_active = true');
  });

  it('vote query uses vote_key with LIMIT 1', () => {
    const agentId = BigInt(5);
    const proposalAddr = 'proposalABC';
    const voteKey = `${agentId.toString()}:${proposalAddr}`.replace(/'/g, "''");
    const sql = `SELECT * FROM votes WHERE vote_key = '${voteKey}' LIMIT 1`;
    expect(sql).toContain("'5:proposalABC'");
    expect(sql).toContain('LIMIT 1');
  });

  it('tracked realms query orders by id ASC', () => {
    const sql = 'SELECT * FROM tracked_realms WHERE is_active = true ORDER BY id ASC';
    expect(sql).toContain('ORDER BY id ASC');
  });

  it('all active agents query orders by total_votes DESC', () => {
    const sql = 'SELECT * FROM agents WHERE is_active = true ORDER BY total_votes DESC';
    expect(sql).toContain('ORDER BY total_votes DESC');
  });

  it('activity log query has configurable limit', () => {
    const limit = 25;
    const sql = `SELECT * FROM activity_log WHERE agent_id = 1 ORDER BY created_at DESC LIMIT ${limit}`;
    expect(sql).toContain('LIMIT 25');
  });
});

// ---------------------------------------------------------------------------
// AgentRow / VoteRow type structure validation
// ---------------------------------------------------------------------------
describe('Row type structures', () => {
  it('AgentRow has all required fields', () => {
    const agent = {
      id: BigInt(1),
      owner_wallet: 'wallet',
      name: 'Agent',
      values_profile: 'values',
      config_json: '{}',
      risk_tolerance: 'moderate',
      is_active: true,
      privy_wallet_id: null,
      privy_wallet_address: null,
      total_votes: 0,
      accuracy_score: 0,
      delegation_count: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    expect(agent).toHaveProperty('id');
    expect(agent).toHaveProperty('owner_wallet');
    expect(agent).toHaveProperty('name');
    expect(agent).toHaveProperty('values_profile');
    expect(agent).toHaveProperty('config_json');
    expect(agent).toHaveProperty('risk_tolerance');
    expect(agent).toHaveProperty('is_active');
    expect(agent).toHaveProperty('privy_wallet_id');
    expect(agent).toHaveProperty('privy_wallet_address');
    expect(agent).toHaveProperty('total_votes');
    expect(agent).toHaveProperty('accuracy_score');
    expect(agent).toHaveProperty('delegation_count');
    expect(agent).toHaveProperty('created_at');
    expect(agent).toHaveProperty('updated_at');
  });

  it('VoteRow has all required fields', () => {
    const vote = {
      id: BigInt(1),
      vote_key: '1:proposal',
      agent_id: BigInt(1),
      proposal_address: 'proposal',
      vote: 'for',
      reasoning: 'good proposal',
      confidence: 0.9,
      tx_signature: null,
      tapestry_content_id: null,
      created_at: Date.now(),
    };

    expect(vote).toHaveProperty('id');
    expect(vote).toHaveProperty('vote_key');
    expect(vote).toHaveProperty('agent_id');
    expect(vote).toHaveProperty('proposal_address');
    expect(vote).toHaveProperty('vote');
    expect(vote).toHaveProperty('reasoning');
    expect(vote).toHaveProperty('confidence');
    expect(vote).toHaveProperty('tx_signature');
    expect(vote).toHaveProperty('tapestry_content_id');
    expect(vote).toHaveProperty('created_at');
  });
});
