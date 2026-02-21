"use client";

import { cn, formatNumber } from "@shared/lib/utils";
import type { Proposal } from "@shared/types/governance";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Clock,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from "lucide-react";
import { useMemo } from "react";

interface ProposalCardProps {
  proposal: Proposal;
}

function getTimeRemaining(deadline: Date): string {
  const now = Date.now();
  const diff = deadline.getTime() - now;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "voting":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "succeeded":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "defeated":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "draft":
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
    case "executing":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "completed":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  }
}

export function ProposalCard({ proposal }: ProposalCardProps) {
  const totalVotes = useMemo(
    () =>
      proposal.forVotes +
      proposal.againstVotes +
      (proposal.abstainVotes ?? 0),
    [proposal.forVotes, proposal.againstVotes, proposal.abstainVotes]
  );

  const forPercent = totalVotes > 0 ? (proposal.forVotes / totalVotes) * 100 : 0;
  const againstPercent =
    totalVotes > 0 ? (proposal.againstVotes / totalVotes) * 100 : 0;
  const abstainPercent =
    totalVotes > 0 ? ((proposal.abstainVotes ?? 0) / totalVotes) * 100 : 0;

  const timeRemaining = getTimeRemaining(proposal.deadline);
  const isActive = proposal.status === "voting";

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
            {proposal.title}
          </CardTitle>
          <Badge
            className={cn(
              "shrink-0 text-[11px] font-medium capitalize",
              statusBadgeClass(proposal.status)
            )}
            variant="outline"
          >
            {proposal.status}
          </Badge>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <span className="truncate text-xs text-muted-foreground">
            {proposal.realmAddress.slice(0, 6)}...{proposal.realmAddress.slice(-4)}
          </span>
          {isActive && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {timeRemaining}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-green-400" />
              For: {formatNumber(proposal.forVotes)}
            </span>
            <span className="flex items-center gap-1">
              Against: {formatNumber(proposal.againstVotes)}
              <ThumbsDown className="h-3 w-3 text-red-400" />
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            {totalVotes > 0 && (
              <>
                <div
                  className="absolute inset-y-0 left-0 rounded-l-full bg-green-500 transition-all duration-500"
                  style={{ width: `${forPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 rounded-r-full bg-red-500 transition-all duration-500"
                  style={{ width: `${againstPercent}%` }}
                />
              </>
            )}
          </div>
          {totalVotes > 0 && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Total: {formatNumber(totalVotes)}</span>
              <span className="inline-flex items-center gap-1">
                <Minus className="h-3 w-3 text-zinc-400" />
                Abstain: {abstainPercent.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
