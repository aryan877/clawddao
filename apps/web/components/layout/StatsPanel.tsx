'use client';

import Link from 'next/link';
import { Activity, FileText, Bot, BarChart3, Plus, Trophy } from 'lucide-react';
import { useTable } from 'spacetimedb/react';
import { tables } from '@/module_bindings';
import { useFeed } from '@/components/providers/FeedProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@shared/lib/utils';

const GRADIENT_PALETTE = [
  'from-emerald-500 to-cyan-500',
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-indigo-500',
];

function pickGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PALETTE[Math.abs(hash) % GRADIENT_PALETTE.length];
}

export function StatsPanel() {
  const { realms, totalProposals, activeProposals } = useFeed();
  const [agentRows] = useTable(tables.agents);
  const [voteRows] = useTable(tables.votes);

  const activeAgents = agentRows.filter((a) => a.isActive).length;

  // Top 3 agents by totalVotes
  const topAgents = [...agentRows]
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .slice(0, 3);

  return (
    <aside className="hidden w-80 shrink-0 xl:block">
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
        {/* Platform Stats */}
        <Card>
          <CardContent className="p-4">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Platform Stats
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatItem
                icon={Activity}
                label="DAOs"
                value={realms.length}
              />
              <StatItem
                icon={FileText}
                label="Proposals"
                value={totalProposals}
              />
              <StatItem
                icon={Bot}
                label="Agents"
                value={activeAgents}
              />
              <StatItem
                icon={BarChart3}
                label="Votes"
                value={voteRows.length}
              />
            </div>
            {activeProposals > 0 && (
              <div className="mt-3 rounded-md bg-primary/10 px-3 py-2 text-center">
                <span className="text-xs font-semibold text-primary">
                  {activeProposals} active proposal{activeProposals !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Agents */}
        {topAgents.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Trophy className="h-3.5 w-3.5" />
                Top Agents
              </h3>
              <div className="mt-3 space-y-2">
                {topAgents.map((agent, idx) => {
                  const gradient = pickGradient(agent.name);
                  return (
                    <Link
                      key={Number(agent.id)}
                      href={`/agents/${agent.id}`}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                    >
                      <span className="text-xs font-bold text-muted-foreground w-4">
                        #{idx + 1}
                      </span>
                      <div
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white',
                          gradient,
                        )}
                      >
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-foreground">
                          {agent.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {agent.totalVotes} votes
                      </span>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Agent CTA */}
        <Card>
          <CardContent className="p-4 text-center">
            <Bot className="mx-auto h-8 w-8 text-primary/60" />
            <p className="mt-2 text-xs text-muted-foreground">
              Create an AI agent to vote on proposals automatically
            </p>
            <Link href="/agents/create" className="mt-3 block">
              <Button size="sm" className="w-full gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Create Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md bg-background/50 p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-primary/60" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className="mt-1 block text-lg font-bold tracking-tight text-foreground">
        {value}
      </span>
    </div>
  );
}
