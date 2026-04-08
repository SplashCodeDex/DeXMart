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

import type { UserContext } from '../tenancy/tenant-context.js';

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
  capability: 'model' | 'channel' | 'agent' | 'message' | 'feature',
  ctx: UserContext,
): string {
  const plan = ctx.plan.charAt(0).toUpperCase() + ctx.plan.slice(1);
  switch (capability) {
    case 'model':
      return `Your ${plan} plan does not include access to this AI model. Upgrade to unlock more models.`;
    case 'channel':
      return `You've reached the channel limit for your ${plan} plan. Upgrade to add more channels.`;
    case 'agent':
      return `You've reached the agent limit for your ${plan} plan. Upgrade to create more agents.`;
    case 'message':
      return `You've reached your monthly message limit on the ${plan} plan. Upgrade for more messages.`;
    case 'feature':
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
  capability: 'model' | 'channel' | 'agent' | 'message' | 'feature',
  ctx: UserContext,
): void {
  if (!allowed) {
    throw Object.assign(
      new Error(buildGateDeniedMessage(capability, ctx)),
      { statusCode: 402, code: `PLAN_LIMIT_${capability.toUpperCase()}` },
    );
  }
}

// ── Grace Zone Gate ───────────────────────────────────────────────────────────

const GRACE_THRESHOLD_PCT = 90;

type GatedCapability = 'channel' | 'message' | 'agent';

function getUsageRatio(ctx: UserContext, capability: GatedCapability): { used: number; limit: number } {
  switch (capability) {
    case 'channel': return { used: ctx.usage.activeChannels, limit: ctx.capabilities.maxChannels };
    case 'message': return { used: ctx.usage.messagesThisPeriod, limit: ctx.capabilities.maxMessagesPerMonth };
    case 'agent':   return { used: ctx.usage.activeAgents, limit: ctx.capabilities.maxAgents };
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
    throw Object.assign(
      new Error(buildGateDeniedMessage(capability, ctx)),
      { statusCode: 402, code: `PLAN_LIMIT_${capability.toUpperCase()}` },
    );
  }

  if (usedPercent >= GRACE_THRESHOLD_PCT) {
    // Grace zone: allow the action but warn the user
    notify(ctx.userId, capability, Math.round(usedPercent * 100) / 100);
  }
}
