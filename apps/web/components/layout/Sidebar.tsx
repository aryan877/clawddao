'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Plus,
  Wallet,
  LogOut,
} from 'lucide-react';
import { cn, shortAddress } from '@shared/lib/utils';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Agents', href: '/agents', icon: Bot },
  { label: 'Social Feed', href: '/social', icon: MessageSquare },
];

const secondaryItems = [
  { label: 'Create Agent', href: '/agents/create', icon: Plus },
];

export function Sidebar() {
  const pathname = usePathname();
  const { authenticated, walletAddress, login, logout } = useWallet();

  function isActive(href: string) {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
    }
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="text-2xl" role="img" aria-label="claw">
          🐾
        </span>
        <span className="text-lg font-bold tracking-tight text-foreground">
          ClawdDAO
        </span>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 space-y-1 px-3 pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {/* Separator */}
        <div className="my-3 h-px bg-sidebar-border" />

        {secondaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Wallet section */}
      <div className="border-t border-sidebar-border px-4 py-4">
        {authenticated && walletAddress ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-mono text-foreground">
                {shortAddress(walletAddress)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={login}
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        )}
      </div>
    </aside>
  );
}
