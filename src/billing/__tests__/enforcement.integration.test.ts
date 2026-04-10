/**
 * enforcement.integration.test.ts
 *
 * Billing Enforcement Integration Tests
 *
 * Proves that the billing gate layer correctly enforces plan limits:
 * - Free tier model filtering via filterModelsForUser
 * - Hard gate failures (402) for channels, agents, messages, features
 * - Grace zone warnings (90-99%) before hard block
 * - Upgrade path: denied on Free → upgrade to Pro → assertCan passes
 * - Structured PLAN_LIMIT_* error codes on all gate denials
 */

import { describe, it, expect, vi } from 'vitest';
import {
  filterModelsForUser,
  assertCan,
  assertCanWithGrace,
  buildGateDeniedMessage,
  makeBillingWarningNotifier,
  type GraceNotifier,
} from '../auth-guard.js';
import {
  createAuthGuard,
  PLAN_CAPABILITIES,
  type UserContext,
  type PlanTier,
} from '../../tenancy/tenant-context.js';

// ── Test helper ────────────────────────────────────────────────────────────────

function makeCtx(plan: PlanTier, usageOverrides: Partial<UserContext['usage']> = {}): UserContext {
  const now = new Date();
  return {
    userId: `user-${plan}-test`,
    displayName: `Test ${plan} user`,
    email: `${plan}@test.example`,
    plan,
    capabilities: PLAN_CAPABILITIES[plan],
    usage: {
      messagesThisPeriod: 0,
      activeChannels: 0,
      activeAgents: 0,
      tokensConsumed: 0,
      periodStart: now,
      periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      ...usageOverrides,
    },
    subscription: {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      isActive: true,
      isTrial: false,
      trialEndsAt: null,
      isOverLimit: false,
    },
    meta: { createdAt: now, lastActiveAt: now, timezone: 'UTC' },
  };
}

// ── Model gating ───────────────────────────────────────────────────────────────

describe('filterModelsForUser — model gating', () => {
  const proModels = [
    'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro',
    'claude-sonnet-4-20250514', 'gpt-4o',
  ];

  it('Free tier: returns only gemini-2.0-flash from a Pro config', () => {
    const ctx = makeCtx('free');
    const result = filterModelsForUser(ctx, proModels);
    expect(result).toEqual(['gemini-2.0-flash']);
  });

  it('Free tier: returns empty array when no configured models are in Free plan', () => {
    const ctx = makeCtx('free');
    const result = filterModelsForUser(ctx, ['claude-sonnet-4-20250514', 'gpt-4o']);
    expect(result).toEqual([]);
  });

  it('Starter tier: returns only Starter-allowed models', () => {
    const ctx = makeCtx('starter');
    const result = filterModelsForUser(ctx, proModels);
    expect(result).toEqual(['gemini-2.0-flash', 'gemini-2.5-flash']);
  });

  it('Pro tier: returns all Pro models from a full configured list', () => {
    const ctx = makeCtx('pro');
    const result = filterModelsForUser(ctx, proModels);
    expect(result).toEqual(proModels);
  });

  it('Pro tier: returns all Pro-allowed models when Enterprise-only models are in config', () => {
    const ctx = makeCtx('pro');
    const enterpriseConfig = [...proModels, 'claude-opus-4-20250514', 'gpt-4.1'];
    const result = filterModelsForUser(ctx, enterpriseConfig);
    expect(result).not.toContain('claude-opus-4-20250514');
    expect(result).not.toContain('gpt-4.1');
    expect(result).toContain('claude-sonnet-4-20250514');
  });

  it('Enterprise tier: returns all models including enterprise-only ones', () => {
    const ctx = makeCtx('enterprise');
    const fullConfig = [...proModels, 'claude-opus-4-20250514', 'gpt-4.1'];
    const result = filterModelsForUser(ctx, fullConfig);
    expect(result).toContain('claude-opus-4-20250514');
    expect(result).toContain('gpt-4.1');
  });

  it('preserves the order of configuredModels in the output', () => {
    const ctx = makeCtx('starter');
    const ordered = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gpt-4o'];
    const result = filterModelsForUser(ctx, ordered);
    expect(result).toEqual(['gemini-2.5-flash', 'gemini-2.0-flash']);
  });
});

// ── assertCan: hard gate failures ─────────────────────────────────────────────

describe('assertCan — hard gate failures (HTTP 402)', () => {
  it('throws 402 when Free user is at maxChannels limit', () => {
    const ctx = makeCtx('free', { activeChannels: 1 }); // 1/1 = at limit
    const guard = createAuthGuard(ctx);

    expect(() => assertCan(guard.canStartChannel(), 'channel', ctx))
      .toThrow(expect.objectContaining({ statusCode: 402, code: 'PLAN_LIMIT_CHANNEL' }));
  });

  it('throws 402 when Free user is at maxAgents limit', () => {
    const ctx = makeCtx('free', { activeAgents: 1 }); // 1/1 = at limit
    const guard = createAuthGuard(ctx);

    expect(() => assertCan(guard.canCreateAgent(), 'agent', ctx))
      .toThrow(expect.objectContaining({ statusCode: 402, code: 'PLAN_LIMIT_AGENT' }));
  });

  it('throws 402 when Free user exhausts monthly message quota', () => {
    const ctx = makeCtx('free', { messagesThisPeriod: 100 }); // 100/100 = at limit
    const guard = createAuthGuard(ctx);

    expect(() => assertCan(guard.canSendMessage(), 'message', ctx))
      .toThrow(expect.objectContaining({ statusCode: 402, code: 'PLAN_LIMIT_MESSAGE' }));
  });

  it('throws 402 when Free user tries to use a gated feature (campaigns)', () => {
    const ctx = makeCtx('free');
    const guard = createAuthGuard(ctx);

    expect(() => assertCan(guard.hasFeature('campaigns'), 'feature', ctx))
      .toThrow(expect.objectContaining({ statusCode: 402, code: 'PLAN_LIMIT_FEATURE' }));
  });

  it('does NOT throw when user is within limits', () => {
    const ctx = makeCtx('free', { activeChannels: 0, messagesThisPeriod: 50 });
    const guard = createAuthGuard(ctx);

    expect(() => assertCan(guard.canStartChannel(), 'channel', ctx)).not.toThrow();
    expect(() => assertCan(guard.canSendMessage(), 'message', ctx)).not.toThrow();
  });

  it('error message references the user\'s plan tier', () => {
    const ctx = makeCtx('starter', { messagesThisPeriod: 5000 }); // 5000/5000
    const guard = createAuthGuard(ctx);

    let thrown: Error | undefined;
    try {
      assertCan(guard.canSendMessage(), 'message', ctx);
    } catch (err) {
      thrown = err as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown!.message).toMatch(/Starter/i);
  });

  it('Enterprise tier never throws for channel/agent/message limits (unlimited)', () => {
    const ctx = makeCtx('enterprise', {
      activeChannels: 9999,
      activeAgents: 9999,
      messagesThisPeriod: 9_999_999,
    });
    const guard = createAuthGuard(ctx);

    expect(() => assertCan(guard.canStartChannel(), 'channel', ctx)).not.toThrow();
    expect(() => assertCan(guard.canCreateAgent(), 'agent', ctx)).not.toThrow();
    expect(() => assertCan(guard.canSendMessage(), 'message', ctx)).not.toThrow();
  });
});

// ── Upgrade path ──────────────────────────────────────────────────────────────

describe('Upgrade path — denied on Free, passes after upgrading to Pro', () => {
  it('model denied on Free, allowed after upgrading context to Pro', () => {
    const freeCtx = makeCtx('free');
    const freeGuard = createAuthGuard(freeCtx);

    expect(freeGuard.canUseModel('claude-sonnet-4-20250514')).toBe(false);

    // Simulate plan upgrade — new context resolved with Pro capabilities
    const proCtx = { ...freeCtx, plan: 'pro' as PlanTier, capabilities: PLAN_CAPABILITIES.pro };
    const proGuard = createAuthGuard(proCtx);

    expect(proGuard.canUseModel('claude-sonnet-4-20250514')).toBe(true);
  });

  it('channel gate denied on Free (at limit), passes after upgrade to Starter', () => {
    const freeCtx = makeCtx('free', { activeChannels: 1 }); // at Free limit
    expect(createAuthGuard(freeCtx).canStartChannel()).toBe(false);

    // After upgrade: same usage count, but Starter allows up to 3
    const starterCtx = {
      ...freeCtx,
      plan: 'starter' as PlanTier,
      capabilities: PLAN_CAPABILITIES.starter,
    };
    expect(createAuthGuard(starterCtx).canStartChannel()).toBe(true); // 1/3 — has room
  });

  it('feature gate denied on Free, unlocked after upgrade to Starter', () => {
    const freeCtx = makeCtx('free');
    expect(createAuthGuard(freeCtx).hasFeature('campaigns')).toBe(false);

    const starterCtx = { ...freeCtx, plan: 'starter' as PlanTier, capabilities: PLAN_CAPABILITIES.starter };
    expect(createAuthGuard(starterCtx).hasFeature('campaigns')).toBe(true);
  });
});

// ── Grace zone ────────────────────────────────────────────────────────────────

describe('assertCanWithGrace — 10% grace zone before hard block', () => {
  it('does not notify or throw below the 90% threshold', () => {
    const ctx = makeCtx('free', { messagesThisPeriod: 89 }); // 89% of 100
    const notify = vi.fn<GraceNotifier>();

    expect(() => assertCanWithGrace(ctx, 'message', notify)).not.toThrow();
    expect(notify).not.toHaveBeenCalled();
  });

  it('calls notify (but does not throw) at exactly 90% usage', () => {
    const ctx = makeCtx('free', { messagesThisPeriod: 90 }); // 90% of 100
    const notify = vi.fn<GraceNotifier>();

    expect(() => assertCanWithGrace(ctx, 'message', notify)).not.toThrow();
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(ctx.userId, 'message', 90);
  });

  it('calls notify in grace zone between 90–99%', () => {
    const ctx = makeCtx('free', { messagesThisPeriod: 95 }); // 95% of 100
    const notify = vi.fn<GraceNotifier>();

    expect(() => assertCanWithGrace(ctx, 'message', notify)).not.toThrow();
    expect(notify).toHaveBeenCalledWith(ctx.userId, 'message', 95);
  });

  it('throws 402 at 100% usage — hard block, notify NOT called', () => {
    const ctx = makeCtx('free', { messagesThisPeriod: 100 }); // 100% of 100
    const notify = vi.fn<GraceNotifier>();

    expect(() => assertCanWithGrace(ctx, 'message', notify))
      .toThrow(expect.objectContaining({ statusCode: 402, code: 'PLAN_LIMIT_MESSAGE' }));
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not throw or notify for unlimited plan (enterprise)', () => {
    const ctx = makeCtx('enterprise', { messagesThisPeriod: 999_999_999 });
    const notify = vi.fn<GraceNotifier>();

    expect(() => assertCanWithGrace(ctx, 'message', notify)).not.toThrow();
    expect(notify).not.toHaveBeenCalled();
  });

  it('grace zone applies to channel capacity', () => {
    // Pro: maxChannels = 10, 9/10 = 90%
    const ctx = makeCtx('pro', { activeChannels: 9 });
    const notify = vi.fn<GraceNotifier>();

    expect(() => assertCanWithGrace(ctx, 'channel', notify)).not.toThrow();
    expect(notify).toHaveBeenCalledWith(ctx.userId, 'channel', 90);
  });

  it('grace zone applies to agent capacity', () => {
    // Pro: maxAgents = 5, 5/5 = 100% → hard block
    const ctx = makeCtx('pro', { activeAgents: 5 });
    const notify = vi.fn<GraceNotifier>();

    expect(() => assertCanWithGrace(ctx, 'agent', notify))
      .toThrow(expect.objectContaining({ statusCode: 402, code: 'PLAN_LIMIT_AGENT' }));
  });
});

// ── makeBillingWarningNotifier ────────────────────────────────────────────────

describe('makeBillingWarningNotifier — socket integration', () => {
  it('creates a notifier that forwards warnings to the socket emitter', () => {
    const mockSocket = { emitBillingWarning: vi.fn() };
    const notify = makeBillingWarningNotifier(mockSocket);

    notify('user-123', 'message', 95);

    expect(mockSocket.emitBillingWarning).toHaveBeenCalledWith('user-123', 'message', 95);
  });
});

// ── buildGateDeniedMessage ────────────────────────────────────────────────────

describe('buildGateDeniedMessage — structured denial messages', () => {
  it('includes plan name and channel-specific guidance', () => {
    const ctx = makeCtx('free');
    const msg = buildGateDeniedMessage('channel', ctx);
    expect(msg).toMatch(/Free/i);
    expect(msg).toMatch(/channel/i);
  });

  it('includes plan name for model denial', () => {
    const ctx = makeCtx('starter');
    const msg = buildGateDeniedMessage('model', ctx);
    expect(msg).toMatch(/Starter/i);
    expect(msg).toMatch(/model/i);
  });

  it('capitalizes plan tier in all denial messages', () => {
    (['free', 'starter', 'pro', 'enterprise'] as PlanTier[]).forEach((plan) => {
      const ctx = makeCtx(plan);
      const msg = buildGateDeniedMessage('feature', ctx);
      const expected = plan.charAt(0).toUpperCase() + plan.slice(1);
      expect(msg).toContain(expected);
    });
  });
});
