/**
 * TenantContext — The Core Abstraction for DeXMart's Multi-Tenant Architecture
 * 
 * This flows through EVERY tenant-scoped request. It replaces OpenClaw's
 * global loadConfig() with per-tenant resolution from Firestore.
 * 
 * This is NOT a plugin. This is NOT optional. This is the foundation
 * that makes OpenClaw's single-tenant engine work for multiple tenants.
 * 
 * Think of it like: OpenClaw is the engine, TenantContext is the key
 * that tells the engine WHO it's running for.
 */

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface TenantCapabilities {
  /** Which AI model providers this tenant can use */
  models: string[];
  /** Maximum simultaneous channels */
  maxChannels: number;
  /** Maximum agents per tenant */
  maxAgents: number;
  /** Monthly message cap (-1 = unlimited) */
  maxMessagesPerMonth: number;
  /** Maximum skills/tools */
  maxSkills: number;
  /** Feature flags based on plan */
  features: {
    campaigns: boolean;
    antiBan: boolean;
    aiSpinning: boolean;
    customTools: boolean;
    subagents: boolean;
    mastermindStream: boolean;
    analytics: boolean;
    contentModeration: boolean;
    auditLogging: boolean;
    webhooks: boolean;
    apiAccess: boolean;
  };
}

export interface TenantUsage {
  /** Messages sent this billing period */
  messagesThisPeriod: number;
  /** Currently active channels */
  activeChannels: number;
  /** Currently active agents */
  activeAgents: number;
  /** Total AI tokens consumed this period */
  tokensConsumed: number;
  /** Billing period start */
  periodStart: Date;
  /** Billing period end */
  periodEnd: Date;
}

export interface TenantBillingState {
  /** Stripe customer ID */
  stripeCustomerId: string | null;
  /** Stripe subscription ID */
  stripeSubscriptionId: string | null;
  /** Whether the subscription is active */
  isActive: boolean;
  /** Whether the tenant is in a trial period */
  isTrial: boolean;
  /** Trial end date if applicable */
  trialEndsAt: Date | null;
  /** Whether the tenant has exceeded their usage limits */
  isOverLimit: boolean;
}

/**
 * TenantContext is the single object that flows through every
 * tenant-scoped operation in the DeXMart system.
 * 
 * - Gateway receives a request → resolves TenantContext from auth token
 * - Channel receives a message → resolves TenantContext from channel mapping
 * - Agent starts a run → receives TenantContext for model gating
 * - Tool executes → receives TenantContext for feature permission check
 */
export interface TenantContext {
  /** Unique tenant identifier (Firestore document ID) */
  tenantId: string;
  
  /** Human-readable tenant name */
  name: string;
  
  /** Current billing plan tier */
  plan: PlanTier;
  
  /** Resolved capabilities based on plan */
  capabilities: TenantCapabilities;
  
  /** Current usage counters (cached, refreshed periodically) */
  usage: TenantUsage;
  
  /** Billing state */
  billing: TenantBillingState;
  
  /** Tenant-level metadata */
  metadata: {
    createdAt: Date;
    lastActiveAt: Date;
    region: string;
    timezone: string;
  };
}

/**
 * Resolves a TenantContext from various input sources.
 * Used by the gateway, channel adapters, and ingress handlers.
 */
export interface TenantContextResolver {
  /** Resolve from a tenant ID (Firestore lookup) */
  fromTenantId(tenantId: string): Promise<TenantContext>;
  
  /** Resolve from a JWT token (decode → extract tenantId → resolve) */
  fromToken(token: string): Promise<TenantContext>;
  
  /** Resolve from a channel mapping (channelId → tenantId → resolve) */
  fromChannelId(channelId: string): Promise<TenantContext>;
  
  /** Check if a tenant exists and is active */
  isActive(tenantId: string): Promise<boolean>;
}

/**
 * Plan tier definitions with their capability sets.
 * These are the source of truth for what each plan provides.
 */
export const PLAN_CAPABILITIES: Record<PlanTier, TenantCapabilities> = {
  free: {
    models: ['gemini-2.0-flash'],
    maxChannels: 1,
    maxAgents: 1,
    maxMessagesPerMonth: 100,
    maxSkills: 3,
    features: {
      campaigns: false,
      antiBan: false,
      aiSpinning: false,
      customTools: false,
      subagents: false,
      mastermindStream: false,
      analytics: false,
      contentModeration: false,
      auditLogging: false,
      webhooks: false,
      apiAccess: false,
    },
  },
  starter: {
    models: ['gemini-2.0-flash', 'gemini-2.5-flash'],
    maxChannels: 3,
    maxAgents: 2,
    maxMessagesPerMonth: 5_000,
    maxSkills: 10,
    features: {
      campaigns: true,
      antiBan: true,
      aiSpinning: false,
      customTools: false,
      subagents: false,
      mastermindStream: true,
      analytics: true,
      contentModeration: true,
      auditLogging: false,
      webhooks: true,
      apiAccess: false,
    },
  },
  pro: {
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'claude-sonnet-4-20250514', 'gpt-4o'],
    maxChannels: 10,
    maxAgents: 5,
    maxMessagesPerMonth: 50_000,
    maxSkills: 50,
    features: {
      campaigns: true,
      antiBan: true,
      aiSpinning: true,
      customTools: true,
      subagents: true,
      mastermindStream: true,
      analytics: true,
      contentModeration: true,
      auditLogging: true,
      webhooks: true,
      apiAccess: true,
    },
  },
  enterprise: {
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'gpt-4o', 'gpt-4.1'],
    maxChannels: -1, // unlimited
    maxAgents: -1,   // unlimited
    maxMessagesPerMonth: -1, // unlimited
    maxSkills: -1,   // unlimited
    features: {
      campaigns: true,
      antiBan: true,
      aiSpinning: true,
      customTools: true,
      subagents: true,
      mastermindStream: true,
      analytics: true,
      contentModeration: true,
      auditLogging: true,
      webhooks: true,
      apiAccess: true,
    },
  },
};
