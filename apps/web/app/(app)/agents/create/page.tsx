'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AgentCreator } from '@/components/agent/AgentCreator';

export default function CreateAgentPage() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to agents
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Create AI Agent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe your governance philosophy in natural language and deploy an
          autonomous AI voting agent.
        </p>
      </div>

      <AgentCreator />
    </div>
  );
}
