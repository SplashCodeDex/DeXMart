/**
 * auth-guard.ts — DeXMart Fusion: Billing Gate Utilities (Phase 3.2)
 *
 * This module provides helpers that bridge DeXMart's UserContext (plan capabilities)
 * with OpenClaw's engine operations (model selection, channel management, tool execution).
 *
 * Design principles:
 *   - Pure functions: no side effects, fully testable without mocks
 *   - No modification of OpenClaw internals: we wrap, not patch
 *   - UserContext is the single source of truth for capabilities
 *
 * Usage pattern:
 *   1. Resolve UserContext at request boundary (via UserContextResolver)
 *   2. Call filterModelsForUser() before passing config to OpenClaw's model selector
 *   3. Call createAuthGuard(ctx).canStartChannel() before createChannelManager()
 *   4. Call createAuthGuard(ctx).canSendMessage() before OpenClaw processes inbound msg
 */

import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/firebase.js";
import type { UserContext } from "../tenancy/tenant-context.js";
import logger from "../utils/logger.js";

// ── Capability matrix (consolidated from SystemAuthorityService) ──────────────

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

const CAPABILITY_MATRIX: Record<PlanTier, Capabilities> = {
  starter: {
    maxMessages: 1000,
    maxAgents: 1,
    maxChannelSlots: 1,
    minCronIntervalMs: 60 * 60 * 1000,
    allowedSkills: ["basic_reply", "summarize", "translate"],
    features: { marketing: false, backups: false, aiReasoning: true, aiMessageSpinning: false },
    models: ["gemini-1.5-flash"],
  },
  pro: {
    maxMessages: 10000,
    maxAgents: 5,
    maxChannelSlots: 3,
    minCronIntervalMs: 15 * 60 * 1000,
    allowedSkills: [
      "basic_reply",
      "summarize",
      "translate",
      "web_search",
      "file_analysis",
      "image_generation",
    ],
    features: { marketing: true, backups: true, aiReasoning: true, aiMessageSpinning: false },
    models: ["gemini-1.5-flash", "gemini-1.5-pro"],
  },
  enterprise: {
    maxMessages: 10000000,
    maxAgents: 100,
    maxChannelSlots: 100,
    minCronIntervalMs: 1 * 60 * 1000,
    allowedSkills: [
      "basic_reply",
      "summarize",
      "translate",
      "web_search",
      "file_analysis",
      "image_generation",
      "custom_scripting",
      "database_query",
    ],
    features: { marketing: true, backups: true, aiReasoning: true, aiMessageSpinning: true },
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
  },
};

/**
 * Returns the capability set for a billing tier.
 * Falls back to `starter` for unrecognised tiers (safe default).
 */
export function getCapabilities(tier: PlanTier): Capabilities {
  return CAPABILITY_MATRIX[tier] ?? CAPABILITY_MATRIX.starter;
}

/** Minimal interface for the socket notifier dependency — avoids hard-coupling to SocketService. */
interface BillingSocketEmitter {
  emitBillingWarning(userId: string, capability: string, usedPercent: number): unknown;
}

/**
 * Callback invoked when a user enters the grace zone (90–99% of a plan limit).
 * Implementations should push a warning to the user via WebSocket or similar.
 *
 * @param userId      - Firebase UID of the user approaching their limit.
 * @param capability  - Which limit they're approaching ('channel' | 'message' | 'agent').
 * @param usedPercent - Current usage as a percentage of the limit (90–99).
 */
export type GraceNotifier = (userId: string, capability: string, usedPercent: number) => void;

/**
 * Filters a list of configured model IDs to only those allowed by the user's plan.
 *
 * This is the injection point for Phase 3.2 model gating:
 *   - OpenClaw's model selector (buildAllowedModelSet) builds its list from config
 *   - We intersect that list with ctx.capabilities.models before it reaches the selector
 *   - Result: users on a free plan can't select gpt-4o even if it's in the config
 *
 * Order of the input `configuredModels` list is preserved in the output.
 *
 * @param ctx              - The resolved UserContext for the current request.
 * @param configuredModels - All model IDs configured in the OpenClaw config.
 * @returns Filtered list of model IDs the user is allowed to use.
 */
export function filterModelsForUser(ctx: UserContext, configuredModels: string[]): string[] {
  const allowedSet = new Set(ctx.capabilities.models);
  return configuredModels.filter((model) => allowedSet.has(model));
}

/**
 * Returns a human-readable error message for a capability gate failure.
 * Use this to send a consistent, plan-aware error back to the user.
 *
 * @param capability - The capability that was denied.
 * @param ctx        - The user's context (for plan name in the message).
 */
export function buildGateDeniedMessage(
  capability: "model" | "channel" | "agent" | "message" | "feature",
  ctx: UserContext,
): string {
  const plan = ctx.plan.charAt(0).toUpperCase() + ctx.plan.slice(1);
  switch (capability) {
    case "model":
      return `Your ${plan} plan does not include access to this AI model. Upgrade to unlock more models.`;
    case "channel":
      return `You've reached the channel limit for your ${plan} plan. Upgrade to add more channels.`;
    case "agent":
      return `You've reached the agent limit for your ${plan} plan. Upgrade to create more agents.`;
    case "message":
      return `You've reached your monthly message limit on the ${plan} plan. Upgrade for more messages.`;
    case "feature":
      return `This feature is not available on your ${plan} plan. Upgrade to unlock it.`;
  }
}

/**
 * Asserts that a user can perform an action, throwing a structured error if not.
 * Use in middleware or request handlers as a single guard call.
 *
 * @example
 *   assertCan(guard.canSendMessage(), 'message', ctx);
 *
 * @param allowed    - Result of a guard.can*() check.
 * @param capability - The capability being checked (for error message).
 * @param ctx        - User context (for plan name in error message).
 */
export function assertCan(
  allowed: boolean,
  capability: "model" | "channel" | "agent" | "message" | "feature",
  ctx: UserContext,
): void {
  if (!allowed) {
    throw Object.assign(new Error(buildGateDeniedMessage(capability, ctx)), {
      statusCode: 402,
      code: `PLAN_LIMIT_${capability.toUpperCase()}`,
    });
  }
}

// ── Grace Zone Gate ───────────────────────────────────────────────────────────

const GRACE_THRESHOLD_PCT = 90;

type GatedCapability = "channel" | "message" | "agent";

function getUsageRatio(
  ctx: UserContext,
  capability: GatedCapability,
): { used: number; limit: number } {
  switch (capability) {
    case "channel":
      return { used: ctx.usage.activeChannels, limit: ctx.capabilities.maxChannels };
    case "message":
      return { used: ctx.usage.messagesThisPeriod, limit: ctx.capabilities.maxMessagesPerMonth };
    case "agent":
      return { used: ctx.usage.activeAgents, limit: ctx.capabilities.maxAgents };
  }
}

/**
 * Asserts that a user can perform an action, with a soft grace zone before a hard block.
 *
 * Behaviour:
 *   - **< 90% of limit** → allowed, `notify` not called.
 *   - **90–99% of limit** → allowed, `notify` called with current usage percent (grace zone).
 *   - **≥ 100% of limit** → throws HTTP 402 with `PLAN_LIMIT_*` code, `notify` not called.
 *   - **Unlimited plan** (limit = -1) → always allowed, `notify` never called.
 *
 * The `notify` callback is injected so callers can push a WebSocket warning without
 * this module depending directly on the socket service (keeps it unit-testable).
 *
 * @param ctx        - Resolved UserContext for the current user.
 * @param capability - The resource being checked.
 * @param notify     - Called when the user is in the grace zone.
 */
/**
 * Creates a GraceNotifier that pushes a WebSocket billing warning to the user.
 * Inject this at the call site so auth-guard.ts itself stays free of socket deps.
 *
 * @example
 *   const notify = makeBillingWarningNotifier(socketService);
 *   assertCanWithGrace(ctx, 'message', notify);
 */
export function makeBillingWarningNotifier(socket: BillingSocketEmitter): GraceNotifier {
  return (userId, capability, usedPercent) => {
    socket.emitBillingWarning(userId, capability, usedPercent);
  };
}

export function assertCanWithGrace(
  ctx: UserContext,
  capability: GatedCapability,
  notify: GraceNotifier,
): void {
  const { used, limit } = getUsageRatio(ctx, capability);

  // Unlimited plan — skip all checks
  if (limit === -1) return;

  const usedPercent = (used / limit) * 100;

  if (usedPercent >= 100) {
    // Hard block: at or over the limit
    throw Object.assign(new Error(buildGateDeniedMessage(capability, ctx)), {
      statusCode: 402,
      code: `PLAN_LIMIT_${capability.toUpperCase()}`,
    });
  }

  if (usedPercent >= GRACE_THRESHOLD_PCT) {
    // Grace zone: allow the action but warn the user
    notify(ctx.userId, capability, Math.round(usedPercent * 100) / 100);
  }
}

// ── SystemAuthorityService (Deprecated compatibility layer) ──────────────────
// This class is preserved to maintain backward compatibility with legacy
// call sites while they are being migrated to pure auth-guard functions.

/**
 * @deprecated Use pure functions from auth-guard.ts and trackUsage from usage-tracker.ts instead.
 */
export class SystemAuthorityService {
  private static instance: SystemAuthorityService;

  private constructor() {}

  public static getInstance(): SystemAuthorityService {
    if (!SystemAuthorityService.instance) {
      SystemAuthorityService.instance = new SystemAuthorityService();
    }
    return SystemAuthorityService.instance;
  }

  public getCapabilities(tier: PlanTier): Capabilities {
    return getCapabilities(tier);
  }

  public isSkillAllowed(tier: PlanTier, skillId: string): boolean {
    return getCapabilities(tier).allowedSkills.includes(skillId);
  }

  public async checkAuthority(
    userId: string,
    action: "send_message" | "create_agent" | "add_channel",
  ): Promise<{ allowed: boolean; error?: string }> {
    try {
      const userRef = db.doc(`users/${userId}`);
      const doc = await userRef.get();

      if (!doc.exists) {
        return { allowed: false, error: "User not found" };
      }

      const data = doc.data()!;
      const tier = (data.plan || "starter") as PlanTier;
      const caps = this.getCapabilities(tier);

      switch (action) {
        case "send_message": {
          const currentUsage = data.usage?.messagesThisPeriod || data.stats?.totalMessagesSent || 0;
          if (caps.maxMessages !== -1 && currentUsage >= caps.maxMessages) {
            return { allowed: false, error: "Monthly message limit reached" };
          }
          break;
        }
        case "create_agent": {
          const counterRef = db.doc(`users/${userId}/usage/counters`);
          const counterSnap = await counterRef.get();
          const currentCount = counterSnap.exists ? counterSnap.data()?.agentCount || 0 : 0;

          if (caps.maxAgents !== -1 && currentCount >= caps.maxAgents) {
            return { allowed: false, error: `Agent limit reached for ${tier} plan.` };
          }
          break;
        }
        case "add_channel": {
          const currentCount = data.usage?.activeChannels || data.stats?.activeChannels || 0;
          if (caps.maxChannelSlots !== -1 && currentCount >= caps.maxChannelSlots) {
            return { allowed: false, error: `Channel slot limit reached for ${tier} plan.` };
          }
          break;
        }
      }

      return { allowed: true };
    } catch (error: any) {
      logger.error(`SystemAuthorityService.checkAuthority error for ${userId}:`, error);
      return { allowed: true };
    }
  }

  public async recordUsage(
    userId: string,
    metric: "messages" | "agents" | "channels",
    amount: number = 1,
  ): Promise<void> {
    const userRef = db.doc(`users/${userId}`);
    const batch = db.batch();

    try {
      if (metric === "messages") {
        const today = new Date().toISOString().split("T")[0];
        const analyticsRef = db.doc(`users/${userId}/analytics/${today}`);

        batch.set(
          analyticsRef,
          {
            date: today,
            sent: FieldValue.increment(amount),
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );

        batch.set(
          userRef,
          {
            "usage.messagesThisPeriod": FieldValue.increment(amount),
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
      } else if (metric === "agents") {
        const counterRef = db.doc(`users/${userId}/usage/counters`);
        batch.set(
          counterRef,
          {
            agentCount: FieldValue.increment(amount),
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
      } else if (metric === "channels") {
        batch.set(
          userRef,
          {
            "usage.activeChannels": FieldValue.increment(amount),
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
      }

      await batch.commit();
      logger.debug(`[Authority] Recorded ${amount} ${metric} usage for user ${userId}`);
    } catch (error) {
      logger.error(`[Authority] Failed to record ${metric} usage for user ${userId}:`, error);
    }
  }
}

export const systemAuthorityService = SystemAuthorityService.getInstance();
