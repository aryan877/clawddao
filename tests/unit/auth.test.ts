import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @privy-io/server-auth before importing auth module
const mockVerifyAuthToken = vi.fn();

vi.mock('@privy-io/server-auth', () => {
  return {
    PrivyClient: class MockPrivyClient {
      verifyAuthToken = mockVerifyAuthToken;
    },
  };
});

import { verifyAuth, AuthError, _resetAuthClient } from '@shared/lib/auth';

describe('verifyAuth()', () => {
  beforeEach(() => {
    _resetAuthClient();
    mockVerifyAuthToken.mockReset();
    // Ensure env vars are set (setup.ts stubs them, but be explicit)
    vi.stubEnv('PRIVY_APP_ID', 'test-app-id');
    vi.stubEnv('PRIVY_APP_SECRET', 'test-app-secret');
  });

  // -------------------------------------------------------------------------
  // Missing Authorization header
  // -------------------------------------------------------------------------
  it('throws AuthError 401 when Authorization header is missing', async () => {
    const request = new Request('http://localhost/api/test');

    await expect(verifyAuth(request)).rejects.toThrow(AuthError);

    try {
      await verifyAuth(request);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).statusCode).toBe(401);
      expect((error as AuthError).message).toContain('Missing Authorization header');
    }
  });

  // -------------------------------------------------------------------------
  // Malformed header (no "Bearer")
  // -------------------------------------------------------------------------
  it('throws AuthError 401 when header is malformed (no Bearer prefix)', async () => {
    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Basic abc123' },
    });

    await expect(verifyAuth(request)).rejects.toThrow(AuthError);

    try {
      await verifyAuth(request);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).statusCode).toBe(401);
      expect((error as AuthError).message).toContain('Malformed Authorization header');
    }
  });

  it('throws AuthError 401 when header is just "Bearer" with no token', async () => {
    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer' },
    });

    await expect(verifyAuth(request)).rejects.toThrow(AuthError);
  });

  // -------------------------------------------------------------------------
  // Invalid token (PrivyClient.verifyAuthToken throws)
  // -------------------------------------------------------------------------
  it('throws AuthError 401 when token verification fails', async () => {
    mockVerifyAuthToken.mockRejectedValue(new Error('Token expired'));

    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    await expect(verifyAuth(request)).rejects.toThrow(AuthError);

    try {
      await verifyAuth(request);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).statusCode).toBe(401);
      expect((error as AuthError).message).toContain('Invalid or expired token');
    }
  });

  // -------------------------------------------------------------------------
  // Valid token
  // -------------------------------------------------------------------------
  it('returns authenticated result with userId for valid token', async () => {
    mockVerifyAuthToken.mockResolvedValue({
      userId: 'did:privy:user-abc-123',
    });

    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer valid-token-xyz' },
    });

    const result = await verifyAuth(request);
    expect(result).toEqual({
      authenticated: true,
      userId: 'did:privy:user-abc-123',
    });
    expect(mockVerifyAuthToken).toHaveBeenCalledWith('valid-token-xyz');
  });

  it('is case-insensitive for Bearer prefix', async () => {
    mockVerifyAuthToken.mockResolvedValue({
      userId: 'did:privy:user-456',
    });

    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'bearer my-token' },
    });

    const result = await verifyAuth(request);
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe('did:privy:user-456');
  });

  // -------------------------------------------------------------------------
  // Missing env vars
  // -------------------------------------------------------------------------
  it('throws AuthError 500 when PRIVY_APP_ID is missing', async () => {
    vi.stubEnv('PRIVY_APP_ID', '');
    vi.stubEnv('PRIVY_APP_SECRET', 'test-secret');
    _resetAuthClient();

    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer some-token' },
    });

    await expect(verifyAuth(request)).rejects.toThrow(AuthError);

    try {
      await verifyAuth(request);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).statusCode).toBe(500);
      expect((error as AuthError).message).toContain('Server authentication not configured');
    }
  });

  it('throws AuthError 500 when PRIVY_APP_SECRET is missing', async () => {
    vi.stubEnv('PRIVY_APP_ID', 'test-app-id');
    vi.stubEnv('PRIVY_APP_SECRET', '');
    _resetAuthClient();

    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer some-token' },
    });

    await expect(verifyAuth(request)).rejects.toThrow(AuthError);

    try {
      await verifyAuth(request);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).statusCode).toBe(500);
    }
  });

  it('throws AuthError 500 when both env vars are missing', async () => {
    vi.stubEnv('PRIVY_APP_ID', '');
    vi.stubEnv('PRIVY_APP_SECRET', '');
    _resetAuthClient();

    const request = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer some-token' },
    });

    try {
      await verifyAuth(request);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).statusCode).toBe(500);
    }
  });
});

// ---------------------------------------------------------------------------
// AuthError class
// ---------------------------------------------------------------------------
describe('AuthError', () => {
  it('has correct name property', () => {
    const err = new AuthError('test');
    expect(err.name).toBe('AuthError');
  });

  it('defaults to 401 status code', () => {
    const err = new AuthError('unauthorized');
    expect(err.statusCode).toBe(401);
  });

  it('accepts custom status code', () => {
    const err = new AuthError('server error', 500);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('server error');
  });

  it('is an instance of Error', () => {
    const err = new AuthError('test');
    expect(err).toBeInstanceOf(Error);
  });
});
