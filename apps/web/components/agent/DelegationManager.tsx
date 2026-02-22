'use client';

import { Users, Plus, X, ShieldCheck } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { shortAddress } from '@shared/lib/utils';
import type { Delegation } from '@shared/types/governance';
import { AGENT_PERMISSIONS } from '@shared/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DelegationManagerProps {
  agentId: string;
  delegations: Delegation[];
  onDelegate: () => void;
  onRevoke: (id: string) => void;
}

const PERMISSION_LABELS: { bit: number; label: string }[] = [
  { bit: AGENT_PERMISSIONS.VOTE,            label: 'Vote' },
  { bit: AGENT_PERMISSIONS.CREATE_PROPOSAL, label: 'Propose' },
  { bit: AGENT_PERMISSIONS.TREASURY_VIEW,   label: 'Treasury View' },
  { bit: AGENT_PERMISSIONS.TREASURY_EXEC,   label: 'Treasury Exec' },
  { bit: AGENT_PERMISSIONS.DELEGATE,        label: 'Delegate' },
  { bit: AGENT_PERMISSIONS.STAKE,           label: 'Stake' },
  { bit: AGENT_PERMISSIONS.TRADE,           label: 'Trade' },
  { bit: AGENT_PERMISSIONS.ADMIN,           label: 'Admin' },
];

function scopeLabels(bitmap: number): string[] {
  return PERMISSION_LABELS.filter((p) => (bitmap & p.bit) !== 0).map((p) => p.label);
}

export function DelegationManager({
  agentId,
  delegations,
  onDelegate,
  onRevoke,
}: DelegationManagerProps) {
  const activeDelegations = delegations.filter((d) => d.agentId === agentId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Delegations
          {activeDelegations.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeDelegations.length}
            </Badge>
          )}
        </CardTitle>
        <Button size="sm" className="gap-1.5" onClick={onDelegate}>
          <Plus className="h-3.5 w-3.5" />
          Delegate Tokens
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {activeDelegations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
            <ShieldCheck className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No active delegations
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Delegate your governance tokens to let this agent vote on your behalf.
            </p>
          </div>
        ) : (
          activeDelegations.map((d) => {
            const permissions = scopeLabels(d.scopeBitmap);

            return (
              <div
                key={d.id}
                className={cn(
                  'group relative flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50'
                )}
              >
                {/* Left info */}
                <div className="min-w-0 flex-1 space-y-2">
                  {/* Delegator + realm */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">
                      {shortAddress(d.delegatorWallet, 6)}
                    </span>
                    <span className="text-xs text-muted-foreground">in</span>
                    <span className="text-sm font-medium text-foreground">
                      {shortAddress(d.realmAddress, 6)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-auto text-[10px] px-1.5 py-0',
                        d.isActive
                          ? 'border-green-500/30 text-green-400'
                          : 'border-zinc-500/30 text-zinc-400'
                      )}
                    >
                      {d.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Permissions */}
                  {permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {permissions.map((perm) => (
                        <Badge
                          key={perm}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 font-normal"
                        >
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Revoke button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                  onClick={() => onRevoke(d.id)}
                  aria-label="Revoke delegation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
