export type PlanTier = "starter" | "pro" | "enterprise";

export interface Capabilities {
  maxMessages: number;
  maxAgents: number;
  maxChannelSlots: number;
  minCronIntervalMs: number;
  allowedSkills: string[];
  features: {
    marketing: boolean;
    backups: boolean;
    aiReasoning: boolean;
    aiMessageSpinning: boolean;
  };
  models: string[];
}

export interface AuthorityState {
  tier: PlanTier;
  capabilities: Capabilities | null;
  isLoading: boolean;
  error: string | null;
}
