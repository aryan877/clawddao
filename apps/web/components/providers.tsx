'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { connectionBuilder } from '@/lib/spacetimedb';

const solanaConnectors = toSolanaWalletConnectors();
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

export function Providers({ children }: { children: React.ReactNode }) {
  const inner = (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      {children}
    </SpacetimeDBProvider>
  );

  if (!privyAppId || privyAppId.length < 10) {
    return inner;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['wallet'],
        appearance: { theme: 'dark', accentColor: '#EF4444', logo: '/logo-mascot.png' },
        externalWallets: { solana: { connectors: solanaConnectors } },
      }}
    >
      {inner}
    </PrivyProvider>
  );
}
