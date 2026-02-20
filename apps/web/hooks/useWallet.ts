'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';

const noop = () => {};

/**
 * Wrapper hook for Privy wallet auth.
 * Gracefully handles cases where PrivyProvider is not mounted
 * (e.g., during SSG builds when NEXT_PUBLIC_PRIVY_APP_ID is not set).
 */
export function useWallet() {
  try {
    const { ready, authenticated, user, login, logout } = usePrivy();
    const { wallets } = useWallets();

    const primaryWallet = wallets?.[0] ?? null;
    const walletAddress = primaryWallet?.address ?? null;

    return {
      ready,
      authenticated,
      user,
      login,
      logout,
      wallets,
      primaryWallet,
      walletAddress,
    };
  } catch {
    // Privy not available (no provider, SSG build, etc.)
    return {
      ready: false,
      authenticated: false,
      user: null,
      login: noop,
      logout: noop,
      wallets: [],
      primaryWallet: null,
      walletAddress: null,
    };
  }
}
