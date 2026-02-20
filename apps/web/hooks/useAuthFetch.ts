'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback } from 'react';

/**
 * Wraps fetch() with the Privy access token in the Authorization header.
 * Use this for all calls to protected API routes.
 */
export function useAuthFetch() {
  const { getAccessToken } = usePrivy();

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const token = await getAccessToken();

      const headers = new Headers(init?.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return fetch(input, { ...init, headers });
    },
    [getAccessToken],
  );

  return authFetch;
}
