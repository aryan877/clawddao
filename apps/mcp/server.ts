#!/usr/bin/env npx tsx
/**
 * ClawdDAO MCP Server — exposes governance tools to AI clients via stdio.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.CLAWDDAO_API_URL || 'http://localhost:3001';

const server = new Server(
  { name: 'clawd-dao', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } },
);

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_daos',
      description: 'List all tracked DAOs on Solana with proposal counts and governance stats',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'list_proposals',
      description: 'List governance proposals for a specific DAO. Can filter by status.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          realm_address: { type: 'string', description: 'On-chain address of the DAO realm' },
          status: {
            type: 'string',
            enum: ['all', 'voting', 'succeeded', 'defeated', 'draft'],
            description: 'Filter by proposal status (default: all)',
          },
        },
        required: ['realm_address'],
      },
    },
    {
      name: 'analyze_proposal',
      description: 'Get AI-powered analysis of a governance proposal including risk assessment and vote recommendation',
      inputSchema: {
        type: 'object' as const,
        properties: {
          proposal_address: { type: 'string', description: 'On-chain address of the proposal' },
          proposal_title: { type: 'string', description: 'Title of the proposal' },
          proposal_description: { type: 'string', description: 'Description or link' },
          realm_name: { type: 'string', description: 'Name of the DAO' },
          for_votes: { type: 'number', description: 'Current for votes' },
          against_votes: { type: 'number', description: 'Current against votes' },
        },
        required: ['proposal_title', 'proposal_description', 'realm_name'],
      },
    },
    {
      name: 'cast_vote',
      description: 'Cast an AI agent vote on a governance proposal',
      inputSchema: {
        type: 'object' as const,
        properties: {
          agent_id: { type: 'string', description: 'ID of the AI agent' },
          proposal_address: { type: 'string', description: 'On-chain proposal address' },
          proposal_title: { type: 'string', description: 'Proposal title for analysis' },
          proposal_description: { type: 'string', description: 'Proposal description' },
          realm_name: { type: 'string', description: 'DAO name' },
        },
        required: ['agent_id', 'proposal_address', 'proposal_title', 'realm_name'],
      },
    },
    {
      name: 'delegate_tokens',
      description: 'Delegate governance voting power to an AI agent for a specific DAO',
      inputSchema: {
        type: 'object' as const,
        properties: {
          agent_id: { type: 'string', description: 'ID of the AI agent to delegate to' },
          realm_address: { type: 'string', description: 'DAO realm address' },
          delegator_wallet: { type: 'string', description: 'Wallet address of the delegator' },
        },
        required: ['agent_id', 'realm_address', 'delegator_wallet'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'list_daos': {
      const res = await fetch(`${API_BASE}/api/governance/realms`);
      const data = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'list_proposals': {
      const typedArgs = args as { realm_address: string; status?: string };
      const res = await fetch(`${API_BASE}/api/governance/realms/${typedArgs.realm_address}`);
      const data = await res.json();

      let proposals = data.proposals || [];
      if (typedArgs.status && typedArgs.status !== 'all') {
        proposals = proposals.filter((p: { status: string }) => p.status === typedArgs.status);
      }

      return { content: [{ type: 'text', text: JSON.stringify({ realm: data.realm, proposals }, null, 2) }] };
    }

    case 'analyze_proposal': {
      const typedArgs = args as {
        proposal_title: string;
        proposal_description: string;
        realm_name: string;
        for_votes?: number;
        against_votes?: number;
      };

      const res = await fetch(`${API_BASE}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: typedArgs.proposal_title,
          description: typedArgs.proposal_description,
          realmName: typedArgs.realm_name,
          forVotes: typedArgs.for_votes || 0,
          againstVotes: typedArgs.against_votes || 0,
        }),
      });
      const analysis = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }] };
    }

    case 'cast_vote': {
      const typedArgs = args as {
        agent_id: string;
        proposal_address: string;
        proposal_title: string;
        proposal_description?: string;
        realm_name: string;
      };

      const res = await fetch(`${API_BASE}/api/agents/${typedArgs.agent_id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalAddress: typedArgs.proposal_address,
          proposalTitle: typedArgs.proposal_title,
          proposalDescription: typedArgs.proposal_description || typedArgs.proposal_title,
          realmName: typedArgs.realm_name,
        }),
      });
      const result = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'delegate_tokens': {
      const typedArgs = args as {
        agent_id: string;
        realm_address: string;
        delegator_wallet: string;
      };

      const res = await fetch(`${API_BASE}/api/delegations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: typedArgs.agent_id,
          realmAddress: typedArgs.realm_address,
          delegatorWallet: typedArgs.delegator_wallet,
        }),
      });
      const result = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'dao://realms',
      name: 'Tracked DAOs',
      description: 'List of all DAOs tracked by ClawdDAO with their addresses and stats',
      mimeType: 'application/json',
    },
    {
      uri: 'dao://agents',
      name: 'Active AI Agents',
      description: 'All active AI governance agents with their configurations and track records',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'dao://realms': {
      const res = await fetch(`${API_BASE}/api/governance/realms`);
      const data = await res.json();
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
    }

    case 'dao://agents': {
      const res = await fetch(`${API_BASE}/api/agents`);
      const data = await res.json();
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ClawdDAO MCP server running on stdio');
}

main().catch(console.error);
