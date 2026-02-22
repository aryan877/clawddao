'use client';

import Link from 'next/link';
import { Users, Vote, TrendingUp } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { Agent } from '@shared/types/governance';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AgentCardProps {
  agent: Agent;
}

const GRADIENT_PALETTE = [
  'from-emerald-500 to-cyan-500',
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-indigo-500',
  'from-lime-500 to-emerald-500',
];

function pickGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PALETTE[Math.abs(hash) % GRADIENT_PALETTE.length];
}

export function AgentCard({ agent }: AgentCardProps) {
  const gradient = pickGradient(agent.id);
  const truncatedValues =
    agent.valuesProfile.length > 120
      ? agent.valuesProfile.slice(0, 120) + '...'
      : agent.valuesProfile;

  return (
    <Link href={`/agents/${agent.id}`} className="group block">
      <Card className="transition-colors hover:border-primary/30">
        <CardContent className="p-5">
          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white',
                gradient
              )}
            >
              {agent.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {agent.name}
                </h3>
                <Badge
                  variant={agent.isActive ? 'default' : 'secondary'}
                  className={cn(
                    'shrink-0 text-[10px] px-1.5 py-0',
                    agent.isActive
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                  )}
                >
                  {agent.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {truncatedValues}
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCell
              icon={Vote}
              label="Votes"
              value={agent.totalVotes.toLocaleString()}
            />
            <StatCell
              icon={TrendingUp}
              label="Accuracy"
              value={`${Math.round(agent.accuracy * 100)}%`}
              valueColor={
                agent.accuracy >= 0.8
                  ? 'text-green-400'
                  : agent.accuracy >= 0.5
                    ? 'text-yellow-400'
                    : 'text-red-400'
              }
            />
            <StatCell
              icon={Users}
              label="Delegates"
              value={agent.delegationCount.toLocaleString()}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-secondary/50 px-2 py-2">
      <Icon className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
      <span className={cn('text-sm font-semibold', valueColor ?? 'text-foreground')}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
