/**
 * UserContext — The Core Authorization Abstraction for DeXMart
 *
 * DeXMart follows the B2C multi-tenant model (like Spotify, CapCut, Notion):
 * - The User IS the Tenant — no teams, no orgs, no admin/editor roles
 * - Every piece of data (channels, agents, sessions, messages) is tagged with userId
 * - Shared infrastructure — same app, same database for everyone
 * - Logical isolation — the authorization layer ensures User A can't touch User B's data
 *
 * This context flows through EVERY request. OpenClaw's engine functions receive
 * it to know WHO they're operating for, and the billing gate checks WHAT
 * the user's plan allows.
 */

export type PlanTier = "free" | "starter" | "pro" | "enterprise";

export interface UserCapabilities {
  /** Which AI model providers this user can access based on their plan */
  models: string[];
  /** Maximum simultaneous channels this user can have */
  maxChannels: number;
  /** Maximum agents per user */
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

export interface UserUsage {
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

export interface UserSubscription {
  /** Stripe customer ID */
  stripeCustomerId: string | null;
  /** Stripe subscription ID */
  stripeSubscriptionId: string | null;
  /** Whether the subscription is active */
  isActive: boolean;
  /** Whether the user is in a trial period */
  isTrial: boolean;
  /** Trial end date if applicable */
  trialEndsAt: Date | null;
  /** Whether the user has exceeded their usage limits */
  isOverLimit: boolean;
}

/**
 * UserContext is the single object that flows through every
 * user-scoped operation in DeXMart.
 *
 * How it gets created:
 * - Gateway receives a request → JWT decoded → userId extracted → UserContext resolved from Firestore
 * - Channel receives a message → channelId maps to userId → UserContext resolved
 * - Agent starts a run → UserContext passed for model gating
 * - Tool executes → UserContext checked for feature permissions
 *
 * How data is isolated:
 * - Every Firestore document is stored under /users/{userId}/...
 * - Every query filters by userId
 * - Every write tags with userId
 * - If resource.userId !== context.userId → 403 Forbidden
 */
export interface UserContext {
  /**
   * Unique user identifier (Firestore document ID).
   * This is the ISOLATION KEY — every piece of data is tagged with this.
   * Maps to what was previously called "tenantId" in the codebase.
   */
  userId: string;

  /** User's display name */
  displayName: string;

  /** User's email */
  email: string;

  /** Current subscription plan tier */
  plan: PlanTier;

  /** Resolved capabilities based on plan */
  capabilities: UserCapabilities;

  /** Current usage counters (cached, refreshed periodically) */
  usage: UserUsage;

  /** Subscription state */
  subscription: UserSubscription;

  /** Account metadata */
  meta: {
    createdAt: Date;
    lastActiveAt: Date;
    timezone: string;
  };
}

/**
 * Resolves a UserContext from various input sources.
 * Used by the gateway, channel handlers, and ingress service.
 */
export interface UserContextResolver {
  /** Resolve from a user ID (Firestore lookup: /users/{userId}) */
  fromUserId(userId: string): Promise<UserContext>;

  /** Resolve from a JWT token (decode → extract userId → resolve) */
  fromToken(token: string): Promise<UserContext>;

  /**
   * Resolve from a channel ID.
   * Channels are stored under /users/{userId}/agents/{agentId}/channels/{channelId}
   * This reverse-looks up the userId from the channel mapping.
   */
  fromChannelId(channelId: string): Promise<UserContext>;

  /** Check if a user account exists and is active */
  isActive(userId: string): Promise<boolean>;
}

/**
 * Authorization guard — the "wall" between users.
 * Every data access goes through this.
 *
 * Usage:
 *   const guard = createAuthGuard(currentUser);
 *   guard.assertOwns(channel); // throws 403 if channel.userId !== currentUser.userId
 *   guard.canUseModel('claude-sonnet-4-20250514'); // checks plan capabilities
 *   guard.canStartChannel(); // checks maxChannels vs activeChannels
 */
export interface AuthGuard {
  /** Assert that the current user owns this resource */
  assertOwns(resource: { userId: string }): void;

  /** Check if the user's plan allows this AI model */
  canUseModel(modelId: string): boolean;

  /** Check if the user can start another channel */
  canStartChannel(): boolean;

  /** Check if the user can create another agent */
  canCreateAgent(): boolean;

  /** Check if the user can send another message (within monthly limit) */
  canSendMessage(): boolean;

  /** Check if a specific feature is available on the user's plan */
  hasFeature(feature: keyof UserCapabilities["features"]): boolean;
}

export function createAuthGuard(ctx: UserContext): AuthGuard {
  return {
    assertOwns(resource: { userId: string }): void {
      if (resource.userId !== ctx.userId) {
        throw Object.assign(new Error(`Forbidden: user ${ctx.userId} does not own this resource`), {
          statusCode: 403,
        });
      }
    },

    canUseModel(modelId: string): boolean {
      return ctx.capabilities.models.includes(modelId);
    },

    canStartChannel(): boolean {
      if (ctx.capabilities.maxChannels === -1) return true; // unlimited
      return ctx.usage.activeChannels < ctx.capabilities.maxChannels;
    },

    canCreateAgent(): boolean {
      if (ctx.capabilities.maxAgents === -1) return true;
      return ctx.usage.activeAgents < ctx.capabilities.maxAgents;
    },

    canSendMessage(): boolean {
      if (ctx.capabilities.maxMessagesPerMonth === -1) return true;
      return ctx.usage.messagesThisPeriod < ctx.capabilities.maxMessagesPerMonth;
    },

    hasFeature(feature: keyof UserCapabilities["features"]): boolean {
      return ctx.capabilities.features[feature] === true;
    },
  };
}

/**
 * Plan tier definitions with their capability sets.
 * Source of truth for what each plan provides.
 */
export const PLAN_CAPABILITIES: Record<PlanTier, UserCapabilities> = {
  free: {
    models: ["gemini-2.0-flash"],
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
    models: ["gemini-2.0-flash", "gemini-2.5-flash"],
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
    models: [
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "claude-sonnet-4-20250514",
      "gpt-4o",
    ],
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
    models: [
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "gpt-4o",
      "gpt-4.1",
    ],
    maxChannels: -1,
    maxAgents: -1,
    maxMessagesPerMonth: -1,
    maxSkills: -1,
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
