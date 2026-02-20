'use client';

import { Search, Wallet } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shortAddress } from '@shared/lib/utils';

interface HeaderProps {
  title: string;
  className?: string;
}

export function Header({ title, className }: HeaderProps) {
  const { authenticated, walletAddress, login } = useWallet();

  return (
    <header
      className={cn(
        'flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm',
        className
      )}
    >
      {/* Page title */}
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-9"
          />
        </div>

        {/* Connect wallet */}
        {authenticated && walletAddress ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-sm font-mono text-foreground">
              {shortAddress(walletAddress)}
            </span>
          </div>
        ) : (
          <Button onClick={login} size="sm" className="gap-2">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  );
}
