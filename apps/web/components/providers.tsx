'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

const solanaConnectors = toSolanaWalletConnectors();
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

export function Providers({ children }: { children: React.ReactNode }) {
  // Privy validates app ID format — if not set, render children without auth
  // This allows the build to succeed and the app to run in dev without a key
  if (!privyAppId || privyAppId.length < 10) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['google', 'twitter', 'wallet'],
        appearance: { theme: 'dark', accentColor: '#14F195', logo: '/logo.svg' },
        embeddedWallets: { solana: { createOnLogin: 'users-without-wallets' } },
        externalWallets: { solana: { connectors: solanaConnectors } },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
