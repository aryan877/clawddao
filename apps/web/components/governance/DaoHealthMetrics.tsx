"use client";

import { cn, formatNumber } from "@shared/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Vote,
  CheckCircle2,
  Activity,
  UserCheck,
  Wallet,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface DaoHealthMetricsProps {
  metrics: {
    participationRate: number;
    avgVoterTurnout: number;
    proposalSuccessRate: number;
    activeProposals: number;
    totalVoters: number;
    treasuryValue: number;
  };
  className?: string;
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}

function MetricCard({ label, value, icon, trend, trendLabel }: MetricCardProps) {
  return (
    <Card className="transition-all duration-200 hover:border-primary/20">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            {icon}
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1">
            {trend === "up" && (
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
            )}
            {trend === "down" && (
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                trend === "up" && "text-green-400",
                trend === "down" && "text-red-400",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              {trendLabel ?? (trend === "neutral" ? "No change" : "")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DaoHealthMetrics({
  metrics,
  className,
}: DaoHealthMetricsProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      <MetricCard
        label="Participation Rate"
        value={`${metrics.participationRate.toFixed(1)}%`}
        icon={<Activity className="h-5 w-5" />}
        trend={metrics.participationRate >= 50 ? "up" : "down"}
        trendLabel={
          metrics.participationRate >= 50 ? "Healthy" : "Below average"
        }
      />
      <MetricCard
        label="Avg. Voter Turnout"
        value={`${metrics.avgVoterTurnout.toFixed(1)}%`}
        icon={<Vote className="h-5 w-5" />}
        trend={metrics.avgVoterTurnout >= 30 ? "up" : "down"}
        trendLabel={
          metrics.avgVoterTurnout >= 30 ? "Good engagement" : "Low engagement"
        }
      />
      <MetricCard
        label="Proposal Success Rate"
        value={`${metrics.proposalSuccessRate.toFixed(1)}%`}
        icon={<CheckCircle2 className="h-5 w-5" />}
        trend={metrics.proposalSuccessRate >= 60 ? "up" : "neutral"}
        trendLabel={
          metrics.proposalSuccessRate >= 60
            ? "Strong consensus"
            : "Mixed results"
        }
      />
      <MetricCard
        label="Active Proposals"
        value={formatNumber(metrics.activeProposals)}
        icon={<UserCheck className="h-5 w-5" />}
        trend={metrics.activeProposals > 0 ? "up" : "neutral"}
        trendLabel={
          metrics.activeProposals > 0 ? "Governance active" : "No active votes"
        }
      />
      <MetricCard
        label="Total Voters"
        value={formatNumber(metrics.totalVoters)}
        icon={<Users className="h-5 w-5" />}
        trend="up"
        trendLabel="Community growing"
      />
      <MetricCard
        label="Treasury Value"
        value={`${formatNumber(metrics.treasuryValue)} SOL`}
        icon={<Wallet className="h-5 w-5" />}
        trend={metrics.treasuryValue > 0 ? "up" : "neutral"}
        trendLabel={metrics.treasuryValue > 0 ? "Funded" : "Empty treasury"}
      />
    </div>
  );
}
