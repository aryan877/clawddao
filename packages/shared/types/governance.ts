export interface Realm {
  address: string;
  name: string;
  communityMint: string;
  proposalCount: number;
  memberCount: number;
  treasuryBalance?: number;
  logoUrl?: string;
}

export interface Proposal {
  address: string;
  realmAddress: string;
  title: string;
  description: string;
  status: "draft" | "voting" | "succeeded" | "defeated" | "executing" | "completed";
  forVotes: number;
  againstVotes: number;
  abstainVotes?: number;
  deadline: Date;
  createdAt: Date;
  aiAnalysis?: AIAnalysis;
}

export interface AIAnalysis {
  summary: string;
  riskAssessment: {
    treasuryImpact: string;
    securityRisk: string;
    centralizationRisk: string;
    overallRiskScore: number;
  };
  recommendation: {
    vote: "FOR" | "AGAINST" | "ABSTAIN";
    confidence: number;
    reasoning: string;
    conditions: string[];
  };
}

export interface Agent {
  id: string;
  owner: string;
  name: string;
  valuesProfile: string;
  configJson: AgentConfig;
  isActive: boolean;
  onChainPda?: string;
  totalVotes: number;
  accuracy: number;
  delegationCount: number;
  createdAt: Date;
}

export interface AgentConfig {
  values: string[];
  riskTolerance: "conservative" | "moderate" | "aggressive";
  autoVote: boolean;
  confidenceThreshold: number;
  focusAreas: string[];
}

export interface Vote {
  id: string;
  agentId: string;
  proposalAddress: string;
  vote: "for" | "against" | "abstain";
  reasoning: string;
  confidence: number;
  txSignature?: string;
  tapestryContentId?: string;
  createdAt: Date;
}

export interface Delegation {
  id: string;
  delegatorWallet: string;
  agentId: string;
  realmAddress: string;
  scopeBitmap: number;
  isActive: boolean;
  onChainPda?: string;
  createdAt: Date;
}

export interface ActivityLogEntry {
  id: string;
  agentId: string;
  actionType: "vote" | "analyze" | "delegate" | "post";
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
