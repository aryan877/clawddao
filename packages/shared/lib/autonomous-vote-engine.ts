import { analyzeProposal } from './ai';
import { buildCastVoteTransaction } from './solana-governance';
import { signAndSendTransaction } from './privy-client';
import { getOrCreateProfile, postVoteReasoning } from './tapestry';
import {
  hasAgentVoted,
  recordVote,
  storeAIAnalysis,
  type AgentRow,
} from './stdb-client';

export interface GovernanceProposalContext {
  address: string;
  title: string;
  description: string;
  realmName: string;
  forVotes: number;
  againstVotes: number;
  abstainVotes?: number;
  status: string;
}

export interface ParsedAgentConfig {
  autoVote: boolean;
  confidenceThreshold: number;
  values: string[];
  focusAreas: string[];
}

export interface AutonomousVoteResult {
  agentId: string;
  proposalAddress: string;
  executed: boolean;
  skipped: boolean;
  skipReason?: string;
  vote?: string;
  confidence?: number;
  txSignature?: string | null;
  tapestryContentId?: string | null;
  reasoning?: string;
}

function parseAgentConfig(raw: string): ParsedAgentConfig {
  const defaults: ParsedAgentConfig = {
    autoVote: false,
    confidenceThreshold: 0.65,
    values: [],
    focusAreas: [],
  };

  try {
    const parsed = JSON.parse(raw) as Partial<ParsedAgentConfig>;
    return {
      autoVote: parsed.autoVote ?? defaults.autoVote,
      confidenceThreshold:
        typeof parsed.confidenceThreshold === 'number'
          ? parsed.confidenceThreshold
          : defaults.confidenceThreshold,
      values: Array.isArray(parsed.values) ? parsed.values : defaults.values,
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas : defaults.focusAreas,
    };
  } catch {
    return defaults;
  }
}

function normalizeProposalDescription(input: string): string {
  return input && input.length > 0 ? input : 'No description provided on-chain.';
}

function toVoteDirection(vote: 'FOR' | 'AGAINST' | 'ABSTAIN'): 'for' | 'against' | 'abstain' {
  if (vote === 'FOR') return 'for';
  if (vote === 'AGAINST') return 'against';
  return 'abstain';
}

function buildAgentValuesPrompt(agent: AgentRow, config: ParsedAgentConfig): string {
  const valuesText = config.values.length > 0 ? config.values.join(', ') : agent.values_profile;
  const focusText = config.focusAreas.length > 0 ? config.focusAreas.join(', ') : 'general governance';

  return [
    `Agent name: ${agent.name}`,
    `Core values: ${valuesText}`,
    `Focus areas: ${focusText}`,
    `Risk tolerance: ${agent.risk_tolerance}`,
  ].join('\n');
}

export async function executeAutonomousVote(params: {
  agent: AgentRow;
  proposal: GovernanceProposalContext;
  dryRun?: boolean;
}): Promise<AutonomousVoteResult> {
  const { agent, proposal } = params;
  const dryRun = params.dryRun ?? false;
  const agentId = agent.id.toString();

  if (!agent.privy_wallet_id || !agent.privy_wallet_address) {
    return {
      agentId,
      proposalAddress: proposal.address,
      executed: false,
      skipped: true,
      skipReason: 'agent_missing_privy_wallet',
    };
  }

  if (proposal.status.toLowerCase() !== 'voting') {
    return {
      agentId,
      proposalAddress: proposal.address,
      executed: false,
      skipped: true,
      skipReason: 'proposal_not_voting',
    };
  }

  const existing = await hasAgentVoted(agent.id, proposal.address);
  if (existing) {
    return {
      agentId,
      proposalAddress: proposal.address,
      executed: false,
      skipped: true,
      skipReason: 'already_voted',
    };
  }

  const config = parseAgentConfig(agent.config_json);
  if (!config.autoVote) {
    return {
      agentId,
      proposalAddress: proposal.address,
      executed: false,
      skipped: true,
      skipReason: 'auto_vote_disabled',
    };
  }

  const rawAnalysis = await analyzeProposal(
    {
      title: proposal.title,
      description: normalizeProposalDescription(proposal.description),
      realmName: proposal.realmName,
      forVotes: proposal.forVotes,
      againstVotes: proposal.againstVotes,
    },
    buildAgentValuesPrompt(agent, config),
  );

  const recommendation = rawAnalysis.recommendation;
  const voteDirection = toVoteDirection(recommendation.vote);

  await storeAIAnalysis({
    agent_id: agent.id,
    proposal_address: proposal.address,
    analysis_json: JSON.stringify(rawAnalysis),
    recommendation: recommendation.vote,
    confidence: recommendation.confidence,
  });

  if (recommendation.confidence < config.confidenceThreshold) {
    const reason = `Confidence ${recommendation.confidence.toFixed(3)} below threshold ${config.confidenceThreshold.toFixed(3)}.`;

    await recordVote({
      agent_id: agent.id,
      proposal_address: proposal.address,
      vote: 'abstain',
      reasoning: `${recommendation.reasoning}\n\n${reason}`,
      confidence: recommendation.confidence,
      tx_signature: null,
      tapestry_content_id: null,
    });

    return {
      agentId,
      proposalAddress: proposal.address,
      executed: false,
      skipped: true,
      skipReason: 'below_confidence_threshold',
      vote: 'abstain',
      confidence: recommendation.confidence,
      reasoning: `${recommendation.reasoning}\n\n${reason}`,
      txSignature: null,
      tapestryContentId: null,
    };
  }

  if (dryRun) {
    return {
      agentId,
      proposalAddress: proposal.address,
      executed: false,
      skipped: false,
      vote: voteDirection,
      confidence: recommendation.confidence,
      reasoning: recommendation.reasoning,
      txSignature: null,
      tapestryContentId: null,
    };
  }

  let txSignature: string | null = null;
  let tapestryContentId: string | null = null;

  try {
    const { serializedTransaction } = await buildCastVoteTransaction({
      proposalAddress: proposal.address,
      voterWalletAddress: agent.privy_wallet_address,
      voteDirection,
    });

    const txResult = await signAndSendTransaction({
      walletId: agent.privy_wallet_id,
      agentId,
      serializedTransaction,
    });

    txSignature = txResult.txHash ?? null;
  } catch (error) {
    console.error(
      `[autonomous-vote-engine] On-chain vote submission failed for agent=${agentId} proposal=${proposal.address}`,
      error,
    );
  }

  if (process.env.TAPESTRY_API_KEY) {
    try {
      const profile = await getOrCreateProfile(agent.privy_wallet_address, agent.name);
      const profileId = profile?.profile?.id;

      if (profileId) {
        const content = await postVoteReasoning(
          profileId,
          proposal.address,
          agentId,
          voteDirection,
          recommendation.reasoning,
          recommendation.confidence,
        );

        const contentCandidate = content as { id?: string; content?: { id?: string } };
        tapestryContentId = contentCandidate.id ?? contentCandidate.content?.id ?? null;
      }
    } catch (error) {
      console.error(
        `[autonomous-vote-engine] Tapestry post failed for agent=${agentId} proposal=${proposal.address}`,
        error,
      );
    }
  }

  await recordVote({
    agent_id: agent.id,
    proposal_address: proposal.address,
    vote: voteDirection,
    reasoning: recommendation.reasoning,
    confidence: recommendation.confidence,
    tx_signature: txSignature,
    tapestry_content_id: tapestryContentId,
  });

  return {
    agentId,
    proposalAddress: proposal.address,
    executed: true,
    skipped: false,
    vote: voteDirection,
    confidence: recommendation.confidence,
    reasoning: recommendation.reasoning,
    txSignature,
    tapestryContentId,
  };
}

export function isAgentEligibleForAutonomy(agent: AgentRow): boolean {
  if (!agent.is_active) return false;
  if (!agent.privy_wallet_id || !agent.privy_wallet_address) return false;

  const config = parseAgentConfig(agent.config_json);
  return config.autoVote;
}
