"use client";

import type { Proposal } from "@shared/types/governance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, CircleCheck, CircleX, Clock3 } from "lucide-react";

interface VotePanelProps {
  proposal: Proposal;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "voting":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "succeeded":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "defeated":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  }
}

export function VotePanel({ proposal }: VotePanelProps) {
  const isVoting = proposal.status === "voting";
  const isClosed = proposal.status === "succeeded" || proposal.status === "defeated";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-primary" />
          Autonomous Agent Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant="outline" className={statusBadgeClass(proposal.status)}>
          Proposal: {proposal.status}
        </Badge>

        {isVoting && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-300">
            <p className="flex items-center gap-2 font-medium">
              <Clock3 className="h-4 w-4" />
              Agents monitor this proposal continuously.
            </p>
            <p className="mt-1 text-xs text-blue-200/80">
              Votes are executed automatically by the worker when agent policy and confidence thresholds are met.
            </p>
          </div>
        )}

        {isClosed && (
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              {proposal.status === "succeeded" ? (
                <CircleCheck className="h-4 w-4 text-green-400" />
              ) : (
                <CircleX className="h-4 w-4 text-red-400" />
              )}
              Voting window has closed.
            </p>
            <p className="mt-1 text-xs">
              This page remains as an activity monitor; no manual voting actions are available.
            </p>
          </div>
        )}

        {!isVoting && !isClosed && (
          <p className="text-xs text-muted-foreground">
            Agent activity appears here once the proposal reaches active voting.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
