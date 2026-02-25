import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  shortAddress,
  formatNumber,
  formatSOL,
  timeAgo,
  proposalStatusColor,
} from '@shared/lib/utils';

// ---------------------------------------------------------------------------
// cn()
// ---------------------------------------------------------------------------
describe('cn()', () => {
  it('merges class names', () => {
    const result = cn('px-2', 'py-1');
    expect(result).toBe('px-2 py-1');
  });

  it('deduplicates conflicting Tailwind classes via tailwind-merge', () => {
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('handles conditional (falsy) values via clsx', () => {
    const result = cn('base', false && 'hidden', undefined, null, 'extra');
    expect(result).toBe('base extra');
  });

  it('returns empty string when given no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles object syntax from clsx', () => {
    const result = cn({ 'text-red-500': true, 'text-blue-500': false });
    expect(result).toBe('text-red-500');
  });
});

// ---------------------------------------------------------------------------
// shortAddress()
// ---------------------------------------------------------------------------
describe('shortAddress()', () => {
  const addr = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

  it('returns first 4 and last 4 chars by default', () => {
    const result = shortAddress(addr);
    expect(result).toBe('GovE...CVZw');
  });

  it('accepts a custom chars parameter', () => {
    const result = shortAddress(addr, 6);
    expect(result).toBe('GovER5...PPCVZw');
  });

  it('handles chars=1', () => {
    const result = shortAddress(addr, 1);
    expect(result).toBe('G...w');
  });
});

// ---------------------------------------------------------------------------
// formatNumber()
// ---------------------------------------------------------------------------
describe('formatNumber()', () => {
  it('formats millions with M suffix', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M');
  });

  it('formats exactly 1 million', () => {
    expect(formatNumber(1_000_000)).toBe('1.0M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(12_345)).toBe('12.3K');
  });

  it('formats exactly 1000', () => {
    expect(formatNumber(1_000)).toBe('1.0K');
  });

  it('formats numbers below 1000 with toLocaleString', () => {
    expect(formatNumber(999)).toBe('999');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formats large millions', () => {
    expect(formatNumber(45_600_000)).toBe('45.6M');
  });
});

// ---------------------------------------------------------------------------
// formatSOL()
// ---------------------------------------------------------------------------
describe('formatSOL()', () => {
  it('converts lamports to SOL with 4 decimals', () => {
    expect(formatSOL(1_000_000_000)).toBe('1.0000');
  });

  it('handles fractional lamports', () => {
    expect(formatSOL(1_500_000_000)).toBe('1.5000');
  });

  it('handles zero', () => {
    expect(formatSOL(0)).toBe('0.0000');
  });

  it('handles very small amounts', () => {
    expect(formatSOL(1)).toBe('0.0000');
  });

  it('handles sub-lamport precision', () => {
    expect(formatSOL(123_456_789)).toBe('0.1235');
  });
});

// ---------------------------------------------------------------------------
// timeAgo()
// ---------------------------------------------------------------------------
describe('timeAgo()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for less than 60 seconds', () => {
    const date = new Date('2026-02-26T11:59:30Z');
    expect(timeAgo(date)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const date = new Date('2026-02-26T11:55:00Z');
    expect(timeAgo(date)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const date = new Date('2026-02-26T09:00:00Z');
    expect(timeAgo(date)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const date = new Date('2026-02-24T12:00:00Z');
    expect(timeAgo(date)).toBe('2d ago');
  });

  it('returns "just now" for exactly now', () => {
    const date = new Date('2026-02-26T12:00:00Z');
    expect(timeAgo(date)).toBe('just now');
  });

  it('returns 1m ago at exactly 60 seconds', () => {
    const date = new Date('2026-02-26T11:59:00Z');
    expect(timeAgo(date)).toBe('1m ago');
  });

  it('returns 1h ago at exactly 3600 seconds', () => {
    const date = new Date('2026-02-26T11:00:00Z');
    expect(timeAgo(date)).toBe('1h ago');
  });

  it('returns 1d ago at exactly 86400 seconds', () => {
    const date = new Date('2026-02-25T12:00:00Z');
    expect(timeAgo(date)).toBe('1d ago');
  });
});

// ---------------------------------------------------------------------------
// proposalStatusColor()
// ---------------------------------------------------------------------------
describe('proposalStatusColor()', () => {
  it('returns blue for "voting"', () => {
    expect(proposalStatusColor('voting')).toBe('text-blue-400');
  });

  it('returns green for "succeeded"', () => {
    expect(proposalStatusColor('succeeded')).toBe('text-green-400');
  });

  it('returns red for "defeated"', () => {
    expect(proposalStatusColor('defeated')).toBe('text-red-400');
  });

  it('returns zinc-400 for "draft"', () => {
    expect(proposalStatusColor('draft')).toBe('text-zinc-400');
  });

  it('returns yellow for "executing"', () => {
    expect(proposalStatusColor('executing')).toBe('text-yellow-400');
  });

  it('returns zinc-500 for unknown statuses', () => {
    expect(proposalStatusColor('cancelled')).toBe('text-zinc-500');
  });

  it('returns zinc-500 for empty string', () => {
    expect(proposalStatusColor('')).toBe('text-zinc-500');
  });
});
