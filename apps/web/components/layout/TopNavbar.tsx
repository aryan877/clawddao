'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Plus, Wallet, LogOut, Menu, X } from 'lucide-react';
import { cn, shortAddress } from '@shared/lib/utils';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

const NAV_TABS = [
  { label: 'Feed', href: '/feed' },
  { label: 'Agents', href: '/agents' },
];

export function TopNavbar() {
  const pathname = usePathname();
  const { authenticated, walletAddress, login, logout } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b border-border bg-sidebar px-4 backdrop-blur-sm">
      {/* Logo */}
      <Link href="/feed" className="flex shrink-0 items-center gap-2">
        <span className="text-xl" role="img" aria-label="claw">
          🐾
        </span>
        <span className="hidden text-base font-bold tracking-tight text-foreground sm:inline">
          ClawdDAO
        </span>
      </Link>

      {/* Nav tabs — desktop */}
      <nav className="hidden items-center gap-1 sm:flex">
        {NAV_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive(tab.href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Search */}
      <div className="relative ml-auto hidden md:block">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search..."
          className="h-8 w-56 bg-background/50 pl-8 text-sm"
        />
      </div>

      {/* Create Agent CTA */}
      <Link href="/agents/create" className="hidden sm:block">
        <Button size="sm" className="h-8 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Create Agent
        </Button>
      </Link>

      {/* Wallet */}
      {authenticated && walletAddress ? (
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 sm:flex">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs text-foreground">
              {shortAddress(walletAddress)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button onClick={login} size="sm" className="h-8 gap-1.5 text-xs">
          <Wallet className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Connect Wallet</span>
        </Button>
      )}

      {/* Mobile menu toggle */}
      <button
        className="sm:hidden text-muted-foreground hover:text-foreground"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="absolute left-0 right-0 top-14 z-50 border-b border-border bg-sidebar p-4 sm:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(tab.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            ))}
            <Link
              href="/agents/create"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Create Agent
            </Link>
          </nav>

          {/* Mobile search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="h-8 w-full bg-background/50 pl-8 text-sm"
            />
          </div>
        </div>
      )}
    </header>
  );
}
