'use client';

import {
  Shield,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Loader2,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { AIAnalysis } from '@shared/types/governance';

interface AnalysisPanelProps {
  analysis: AIAnalysis;
  isLoading: boolean;
}

function parseRiskScore(riskDescription: string): number {
  const match = riskDescription.match(/(\d+)\s*\/\s*10/);
  if (match) return parseInt(match[1], 10);

  const lower = riskDescription.toLowerCase();
  if (lower.includes('critical') || lower.includes('very high')) return 9;
  if (lower.includes('high')) return 7;
  if (lower.includes('moderate') || lower.includes('medium')) return 5;
  if (lower.includes('low')) return 3;
  if (lower.includes('minimal') || lower.includes('negligible')) return 1;

  return 5;
}

function riskColor(score: number): string {
  if (score <= 3) return 'bg-green-500';
  if (score <= 6) return 'bg-yellow-500';
  return 'bg-red-500';
}

function riskLabel(score: number): string {
  if (score <= 3) return 'Low';
  if (score <= 6) return 'Medium';
  return 'High';
}

function riskTextColor(score: number): string {
  if (score <= 3) return 'text-green-400';
  if (score <= 6) return 'text-yellow-400';
  return 'text-red-400';
}

function RiskBar({
  label,
  icon,
  value,
  description,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  description: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground">
          {icon}
          {label}
        </div>
        <span className={cn('text-xs font-medium', riskTextColor(value))}>
          {riskLabel(value)} ({value}/10)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full transition-all duration-500', riskColor(value))}
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function AnalysisPanel({ analysis, isLoading }: AnalysisPanelProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Analyzing proposal...</p>
      </div>
    );
  }

  const recBadge = (() => {
    switch (analysis.recommendation.vote) {
      case 'FOR':
        return {
          className: 'bg-green-500/15 text-green-400 border-green-500/30',
          icon: <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />,
        };
      case 'AGAINST':
        return {
          className: 'bg-red-500/15 text-red-400 border-red-500/30',
          icon: <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />,
        };
      case 'ABSTAIN':
        return {
          className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
          icon: <Minus className="mr-1.5 h-3.5 w-3.5" />,
        };
    }
  })();

  return (
    <div className="space-y-5">
      {/* Recommendation badge */}
      <div className="flex items-center justify-between">
        <Badge className={cn('text-xs font-medium', recBadge.className)} variant="outline">
          {recBadge.icon}
          Recommends: {analysis.recommendation.vote}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {Math.round(analysis.recommendation.confidence * 100)}% confidence
        </span>
      </div>

      {/* Summary */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-medium text-foreground">Summary</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {analysis.summary}
        </p>
      </div>

      {/* Risk bars */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">Risk Assessment</h4>
        <RiskBar
          label="Treasury Impact"
          icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />}
          value={parseRiskScore(analysis.riskAssessment.treasuryImpact)}
          description={analysis.riskAssessment.treasuryImpact}
        />
        <RiskBar
          label="Security Risk"
          icon={<Shield className="h-4 w-4 text-muted-foreground" />}
          value={parseRiskScore(analysis.riskAssessment.securityRisk)}
          description={analysis.riskAssessment.securityRisk}
        />
        <RiskBar
          label="Centralization"
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          value={parseRiskScore(analysis.riskAssessment.centralizationRisk)}
          description={analysis.riskAssessment.centralizationRisk}
        />

        {/* Overall score */}
        <div className="rounded-lg border border-border bg-secondary/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Overall Risk</span>
            <span
              className={cn(
                'text-base font-bold',
                riskTextColor(analysis.riskAssessment.overallRiskScore),
              )}
            >
              {analysis.riskAssessment.overallRiskScore}/10
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                riskColor(analysis.riskAssessment.overallRiskScore),
              )}
              style={{
                width: `${(analysis.riskAssessment.overallRiskScore / 10) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-medium text-foreground">Reasoning</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {analysis.recommendation.reasoning}
        </p>
      </div>

      {/* Conditions */}
      {analysis.recommendation.conditions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Conditions</h4>
          <ul className="space-y-1.5">
            {analysis.recommendation.conditions.map((condition, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{condition}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
