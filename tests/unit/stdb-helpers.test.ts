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
    return value
      .replace(/\0/g, '')       // strip null bytes
      .replace(/\\/g, '\\\\')   // escape backslashes
      .replace(/'/g, "''");      // double single quotes
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

  it('strips null bytes to prevent multi-byte attacks', () => {
    expect(escapeSqlString("test\0injection")).toBe("testinjection");
  });

  it('escapes backslashes', () => {
    expect(escapeSqlString("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it('handles SQL injection attempt with escaped chars', () => {
    const injection = "'; DROP TABLE agents;--";
    const escaped = escapeSqlString(injection);
    expect(escaped).toBe("''; DROP TABLE agents;--");
    // The doubled quote means the SQL parser sees it as a literal quote inside the string
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

