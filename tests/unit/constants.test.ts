import { describe, it, expect } from 'vitest';
import {
  SPL_GOVERNANCE_PROGRAM_ID,
  SPL_GOVERNANCE_TEST_PROGRAM_ID,
  METAPLEX_CORE_PROGRAM_ID,
  SOULBOUND_ORACLE,
  TAPESTRY_PROGRAM_ID,
  AGENT_PERMISSIONS,
  RISK_LEVELS,
  SOLANA_CHAIN_CONFIG,
  TAPESTRY_API_URL,
} from '@shared/lib/constants';

// ---------------------------------------------------------------------------
// Program IDs
// ---------------------------------------------------------------------------
describe('Program IDs', () => {
  it('SPL_GOVERNANCE_PROGRAM_ID is the known mainnet address', () => {
    expect(SPL_GOVERNANCE_PROGRAM_ID).toBe('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');
  });

  it('SPL_GOVERNANCE_TEST_PROGRAM_ID exists and is a base58 string', () => {
    expect(SPL_GOVERNANCE_TEST_PROGRAM_ID).toBe('GTesTBiEWE32WHXXE2S4XbZvA5CrEc4xs6ZgRe895dP');
  });

  it('METAPLEX_CORE_PROGRAM_ID is defined', () => {
    expect(METAPLEX_CORE_PROGRAM_ID).toBe('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');
  });

  it('SOULBOUND_ORACLE is defined', () => {
    expect(SOULBOUND_ORACLE).toBe('GxaWxaQVeaNeFHehFQEDeKR65MnT6Nup81AGwh2EEnuq');
  });

  it('TAPESTRY_PROGRAM_ID is defined', () => {
    expect(TAPESTRY_PROGRAM_ID).toBe('GraphUyqhPmEAckWzi7zAvbvUTXf8kqX7JtuvdGYRDRh');
  });

  it('all program IDs are non-empty strings', () => {
    for (const id of [
      SPL_GOVERNANCE_PROGRAM_ID,
      SPL_GOVERNANCE_TEST_PROGRAM_ID,
      METAPLEX_CORE_PROGRAM_ID,
      SOULBOUND_ORACLE,
      TAPESTRY_PROGRAM_ID,
    ]) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AGENT_PERMISSIONS bitmaps
// ---------------------------------------------------------------------------
describe('AGENT_PERMISSIONS', () => {
  it('VOTE is bit 0 (value 1)', () => {
    expect(AGENT_PERMISSIONS.VOTE).toBe(1);
  });

  it('CREATE_PROPOSAL is bit 1 (value 2)', () => {
    expect(AGENT_PERMISSIONS.CREATE_PROPOSAL).toBe(2);
  });

  it('TREASURY_VIEW is bit 2 (value 4)', () => {
    expect(AGENT_PERMISSIONS.TREASURY_VIEW).toBe(4);
  });

  it('TREASURY_EXEC is bit 3 (value 8)', () => {
    expect(AGENT_PERMISSIONS.TREASURY_EXEC).toBe(8);
  });

  it('DELEGATE is bit 4 (value 16)', () => {
    expect(AGENT_PERMISSIONS.DELEGATE).toBe(16);
  });

  it('STAKE is bit 5 (value 32)', () => {
    expect(AGENT_PERMISSIONS.STAKE).toBe(32);
  });

  it('TRADE is bit 6 (value 64)', () => {
    expect(AGENT_PERMISSIONS.TRADE).toBe(64);
  });

  it('ADMIN is bit 7 (value 128)', () => {
    expect(AGENT_PERMISSIONS.ADMIN).toBe(128);
  });

  it('all permissions are unique powers of 2', () => {
    const values = Object.values(AGENT_PERMISSIONS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);

    for (const value of values) {
      // A power of 2 has exactly one bit set: (n & (n - 1)) === 0
      expect(value).toBeGreaterThan(0);
      expect(value & (value - 1)).toBe(0);
    }
  });

  it('permissions can be combined with bitwise OR', () => {
    const voteAndPropose = AGENT_PERMISSIONS.VOTE | AGENT_PERMISSIONS.CREATE_PROPOSAL;
    expect(voteAndPropose).toBe(3);
    expect(voteAndPropose & AGENT_PERMISSIONS.VOTE).toBe(AGENT_PERMISSIONS.VOTE);
    expect(voteAndPropose & AGENT_PERMISSIONS.CREATE_PROPOSAL).toBe(AGENT_PERMISSIONS.CREATE_PROPOSAL);
    expect(voteAndPropose & AGENT_PERMISSIONS.ADMIN).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RISK_LEVELS
// ---------------------------------------------------------------------------
describe('RISK_LEVELS', () => {
  it('has LOW, MEDIUM, and HIGH entries', () => {
    expect(RISK_LEVELS).toHaveProperty('LOW');
    expect(RISK_LEVELS).toHaveProperty('MEDIUM');
    expect(RISK_LEVELS).toHaveProperty('HIGH');
  });

  it('each level has label, color, and bg properties', () => {
    for (const level of Object.values(RISK_LEVELS)) {
      expect(level).toHaveProperty('label');
      expect(level).toHaveProperty('color');
      expect(level).toHaveProperty('bg');
      expect(typeof level.label).toBe('string');
      expect(typeof level.color).toBe('string');
      expect(typeof level.bg).toBe('string');
    }
  });

  it('LOW has green color', () => {
    expect(RISK_LEVELS.LOW.color).toContain('green');
    expect(RISK_LEVELS.LOW.label).toBe('Low Risk');
  });

  it('MEDIUM has yellow color', () => {
    expect(RISK_LEVELS.MEDIUM.color).toContain('yellow');
    expect(RISK_LEVELS.MEDIUM.label).toBe('Medium Risk');
  });

  it('HIGH has red color', () => {
    expect(RISK_LEVELS.HIGH.color).toContain('red');
    expect(RISK_LEVELS.HIGH.label).toBe('High Risk');
  });
});

// ---------------------------------------------------------------------------
// SOLANA_CHAIN_CONFIG
// ---------------------------------------------------------------------------
describe('SOLANA_CHAIN_CONFIG', () => {
  it('has required fields: network, caip2, chainId, rpcUrl', () => {
    expect(SOLANA_CHAIN_CONFIG).toHaveProperty('network');
    expect(SOLANA_CHAIN_CONFIG).toHaveProperty('caip2');
    expect(SOLANA_CHAIN_CONFIG).toHaveProperty('chainId');
    expect(SOLANA_CHAIN_CONFIG).toHaveProperty('rpcUrl');
  });

  it('network is either devnet or mainnet', () => {
    expect(['devnet', 'mainnet']).toContain(SOLANA_CHAIN_CONFIG.network);
  });

  it('caip2 starts with "solana:"', () => {
    expect(SOLANA_CHAIN_CONFIG.caip2).toMatch(/^solana:/);
  });

  it('chainId is a valid Solana chain identifier', () => {
    // devnet = 103, mainnet = 101
    expect([101, 103]).toContain(SOLANA_CHAIN_CONFIG.chainId);
  });

  it('rpcUrl is a valid URL string', () => {
    expect(SOLANA_CHAIN_CONFIG.rpcUrl).toMatch(/^https?:\/\//);
  });

  // Note: SOLANA_CHAIN_CONFIG is evaluated at module-load time, so the rpcUrl
  // depends on whether HELIUS_API_KEY was set *before* the module was first imported.
  // We verify it has a valid URL rather than checking the specific provider.
  it('rpcUrl contains the expected network segment or is a public endpoint', () => {
    expect(SOLANA_CHAIN_CONFIG.rpcUrl).toMatch(/helius-rpc\.com|solana\.com/);
  });
});

// ---------------------------------------------------------------------------
// TAPESTRY_API_URL
// ---------------------------------------------------------------------------
describe('TAPESTRY_API_URL', () => {
  it('is a valid URL string', () => {
    expect(typeof TAPESTRY_API_URL).toBe('string');
    expect(TAPESTRY_API_URL).toMatch(/^https?:\/\//);
  });
});
