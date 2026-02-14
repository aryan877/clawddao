export const SPL_GOVERNANCE_PROGRAM_ID = "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw";
export const SPL_GOVERNANCE_TEST_PROGRAM_ID = "GTesTBiEWE32WHXXE2S4XbZvA5CrEc4xs6ZgRe895dP";
export const METAPLEX_CORE_PROGRAM_ID = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
export const SOULBOUND_ORACLE = "GxaWxaQVeaNeFHehFQEDeKR65MnT6Nup81AGwh2EEnuq";
export const TAPESTRY_PROGRAM_ID = "GraphUyqhPmEAckWzi7zAvbvUTXf8kqX7JtuvdGYRDRh";

const HELIUS_KEY = process.env.HELIUS_API_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY;

export const TAPESTRY_API_URL = process.env.TAPESTRY_URL || "https://api.usetapestry.dev/api/v1";

export const AGENT_PERMISSIONS = {
  VOTE: 1 << 0,
  CREATE_PROPOSAL: 1 << 1,
  TREASURY_VIEW: 1 << 2,
  TREASURY_EXEC: 1 << 3,
  DELEGATE: 1 << 4,
  STAKE: 1 << 5,
  TRADE: 1 << 6,
  ADMIN: 1 << 7,
} as const;

export const RISK_LEVELS = {
  LOW: { label: "Low Risk", color: "text-green-400", bg: "bg-green-400/10" },
  MEDIUM: { label: "Medium Risk", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  HIGH: { label: "High Risk", color: "text-red-400", bg: "bg-red-400/10" },
} as const;

const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";

function buildRpcUrl(): string {
  if (!HELIUS_KEY) return SOLANA_NETWORK === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";
  const subdomain = SOLANA_NETWORK === "devnet" ? "devnet" : "mainnet";
  return `https://${subdomain}.helius-rpc.com/?api-key=${HELIUS_KEY}`;
}

export const SOLANA_CHAIN_CONFIG = {
  network: SOLANA_NETWORK,
  caip2: SOLANA_NETWORK === "devnet" ? "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" : "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  chainId: SOLANA_NETWORK === "devnet" ? 103 : 101,
  rpcUrl: buildRpcUrl(),
} as const;
