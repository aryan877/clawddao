'use client';

import {
  CheckCircle2,
  Brain,
  Users,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { timeAgo } from '@shared/lib/utils';
import type { ActivityLogEntry } from '@shared/types/governance';

interface AgentActivityFeedProps {
  activities: ActivityLogEntry[];
}

const ACTION_META: Record<
  ActivityLogEntry['actionType'],
  { icon: React.ElementType; color: string; bg: string }
> = {
  vote:     { icon: CheckCircle2,  color: 'text-green-400',  bg: 'bg-green-400/10' },
  analyze:  { icon: Brain,         color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  delegate: { icon: Users,         color: 'text-purple-400', bg: 'bg-purple-400/10' },
  post:     { icon: MessageSquare, color: 'text-amber-400',  bg: 'bg-amber-400/10' },
};

export function AgentActivityFeed({ activities }: AgentActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Brain className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical timeline line */}
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

      {activities.map((entry, idx) => {
        const meta = ACTION_META[entry.actionType];
        const Icon = meta.icon;

        return (
          <div
            key={entry.id}
            className={cn(
              'relative flex items-start gap-4 py-3 pl-0 pr-2',
              idx !== activities.length - 1 && 'border-b border-border/40'
            )}
          >
            {/* Icon circle */}
            <div
              className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border',
                meta.bg
              )}
            >
              <Icon className={cn('h-4 w-4', meta.color)} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-foreground leading-snug">
                {entry.description}
              </p>
              <span className="mt-1 block text-xs text-muted-foreground">
                {timeAgo(new Date(entry.createdAt))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
