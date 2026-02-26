import OpenAI from "openai";
import { z } from "zod";

let _client: OpenAI | null = null;
function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.ZAI_API_KEY || "placeholder",
      baseURL: process.env.ZAI_BASE_URL || "https://open.bigmodel.cn/api/coding/paas/v4/",
    });
  }
  return _client;
}

export const GovernanceAnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence summary of the proposal"),
  risk_assessment: z.object({
    treasury_impact: z.string().describe("How this affects the DAO treasury"),
    security_risk: z.string().describe("Any security implications"),
    centralization_risk: z.string().describe("Impact on decentralization"),
    overall_risk_score: z.number().min(0).max(100).describe("0=no risk, 100=extreme risk"),
  }),
  recommendation: z.object({
    vote: z.enum(["FOR", "AGAINST", "ABSTAIN"]),
    confidence: z.number().min(0).max(1).describe("0-1 confidence score"),
    reasoning: z.string().describe("Detailed reasoning for the vote recommendation"),
    conditions: z.array(z.string()).describe("Conditions or caveats for this recommendation"),
  }),
});

export type GovernanceAnalysis = z.infer<typeof GovernanceAnalysisSchema>;

export async function analyzeProposal(proposal: {
  title: string;
  description: string;
  realmName: string;
  forVotes: number;
  againstVotes: number;
  treasuryBalance?: number;
}, agentValues?: string): Promise<GovernanceAnalysis> {
  const systemPrompt = `You are an AI governance analyst for Solana DAOs. Analyze proposals objectively and provide structured recommendations.
${agentValues ? `\nAgent values/priorities: ${agentValues}` : ""}
Your analysis should consider treasury impact, security risks, centralization risks, and alignment with the DAO's mission.
Respond with valid JSON matching the required schema.`;

  const userPrompt = `Analyze this governance proposal:

**DAO**: ${proposal.realmName}
**Title**: ${proposal.title}
**Description**: ${proposal.description}
**Current Votes**: ${proposal.forVotes} FOR / ${proposal.againstVotes} AGAINST
${proposal.treasuryBalance ? `**Treasury Balance**: ${proposal.treasuryBalance} SOL` : ""}

Provide your analysis as JSON with: summary, risk_assessment (treasury_impact, security_risk, centralization_risk, overall_risk_score 0-100), recommendation (vote FOR/AGAINST/ABSTAIN, confidence 0-1, reasoning, conditions array).`;

  const response = await getClient().chat.completions.create({
    model: "glm-5",
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const parsed = JSON.parse(jsonMatch[1]!.trim());
  return GovernanceAnalysisSchema.parse(parsed);
}

export async function streamChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemContext?: string
) {
  const system = `You are ClawdDAO's AI governance assistant. Help users understand DAO proposals, voting strategies, and governance concepts on Solana.
${systemContext ? `\nContext: ${systemContext}` : ""}
Be concise, accurate, and helpful. When discussing proposals, always consider risks and tradeoffs.`;

  return getClient().chat.completions.create({
    model: "glm-5",
    max_tokens: 2048,
    messages: [
      { role: "system", content: system },
      ...messages,
    ],
    stream: true,
  });
}

export async function generateAgentConfig(naturalLanguageValues: string): Promise<{
  values: string[];
  riskTolerance: "conservative" | "moderate" | "aggressive";
  autoVote: boolean;
  confidenceThreshold: number;
  focusAreas: string[];
}> {
  const response = await getClient().chat.completions.create({
    model: "glm-5",
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content: "Extract structured governance preferences from natural language. Respond only with valid JSON.",
      },
      {
        role: "user",
        content: `Convert this natural language governance philosophy into a structured agent configuration:

"${naturalLanguageValues}"

Respond with JSON: { "values": string[] (3-5 core values), "riskTolerance": "conservative"|"moderate"|"aggressive", "autoVote": boolean (should the agent vote autonomously?), "confidenceThreshold": number (0-1, minimum confidence to auto-vote), "focusAreas": string[] (governance areas of interest) }`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  return JSON.parse(jsonMatch[1]!.trim());
}
