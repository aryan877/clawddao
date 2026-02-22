'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Sparkles,
  Loader2,
  Rocket,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ToggleLeft,
  ToggleRight,
  Eye,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { AgentConfig } from '@shared/types/governance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const RISK_COLORS: Record<AgentConfig['riskTolerance'], { label: string; color: string; bg: string; icon: React.ElementType }> = {
  conservative: { label: 'Conservative', color: 'text-green-400', bg: 'bg-green-400/10', icon: ShieldCheck },
  moderate:     { label: 'Moderate',     color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: ShieldAlert },
  aggressive:   { label: 'Aggressive',   color: 'text-red-400', bg: 'bg-red-400/10', icon: ShieldOff },
};

export function AgentCreator() {
  const { walletAddress } = useWallet();
  const authFetch = useAuthFetch();
  const [name, setName] = useState('');
  const [valuesInput, setValuesInput] = useState('');
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!valuesInput.trim()) return;
    setIsGenerating(true);
    setError(null);
    setConfig(null);

    try {
      const res = await authFetch('/api/ai/agent-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: valuesInput }),
      });

      if (!res.ok) throw new Error('Failed to generate configuration');

      const data: AgentConfig = await res.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDeploy() {
    if (!config || !name.trim()) return;
    setIsDeploying(true);
    setError(null);

    try {
      const res = await authFetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          valuesProfile: valuesInput,
          configJson: config,
          riskTolerance: config.riskTolerance,
          owner: walletAddress ?? 'autonomous-worker',
        }),
      });

      if (!res.ok) throw new Error('Failed to deploy agent');

      // Reset on success
      setName('');
      setValuesInput('');
      setConfig(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  }

  const risk = config ? RISK_COLORS[config.riskTolerance] : null;
  const RiskIcon = risk?.icon ?? ShieldCheck;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* ---- Form ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Create AI Governance Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="agent-name" className="text-sm font-medium text-foreground">
              Agent Name
            </label>
            <Input
              id="agent-name"
              placeholder="e.g. ConservativeDAO Guardian"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="agent-values" className="text-sm font-medium text-foreground">
              Values &amp; Governance Philosophy
            </label>
            <Textarea
              id="agent-values"
              rows={6}
              className="min-h-[140px] resize-y"
              placeholder="I believe in conservative treasury management, funding developer grants, and transparent governance..."
              value={valuesInput}
              onChange={(e) => setValuesInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Describe your governance preferences in natural language. Our AI will translate this into a structured configuration.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <Button
            className="w-full gap-2"
            onClick={handleGenerate}
            disabled={isGenerating || !valuesInput.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Config...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Config
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ---- Preview Panel ---- */}
      {config && (
        <Card className="animate-fade-in border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-primary" />
              Configuration Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Values */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Core Values
              </span>
              <div className="flex flex-wrap gap-2">
                {config.values.map((v) => (
                  <Badge key={v} variant="secondary" className="text-xs">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Risk Tolerance */}
            {risk && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Risk Tolerance
                </span>
                <div
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2',
                    risk.bg
                  )}
                >
                  <RiskIcon className={cn('h-5 w-5', risk.color)} />
                  <span className={cn('text-sm font-semibold', risk.color)}>
                    {risk.label}
                  </span>
                </div>
              </div>
            )}

            {/* Auto-Vote */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Auto-Vote
              </span>
              <div className="flex items-center gap-2">
                {config.autoVote ? (
                  <ToggleRight className="h-6 w-6 text-primary" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">
                  {config.autoVote ? 'Enabled — Agent will vote automatically when confidence threshold is met' : 'Disabled — Manual approval required'}
                </span>
              </div>
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confidence Threshold
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {Math.round(config.confidenceThreshold * 100)}%
                </span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${config.confidenceThreshold * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Agent will only act when its confidence exceeds this threshold.
              </p>
            </div>

            {/* Focus Areas */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Focus Areas
              </span>
              <div className="flex flex-wrap gap-2">
                {config.focusAreas.map((area) => (
                  <Badge key={area} variant="outline" className="text-xs">
                    {area}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Deploy */}
            <div className="border-t border-border pt-4">
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleDeploy}
                disabled={isDeploying || !name.trim()}
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deploying Agent...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Deploy Agent
                  </>
                )}
              </Button>
              {!name.trim() && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Enter an agent name above before deploying.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
