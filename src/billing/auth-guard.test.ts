/**
 * Tests for createAuthGuard + filterModelsForUser (Phase 3.2 spec).
 *
 * Strategy:
 *   - Test createAuthGuard against every UserContext capability combination.
 *   - Test filterModelsForUser: verifies intersection of plan-allowed models
 *     with the set of models actually configured in OpenClaw config.
 *   - No external deps — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import { createAuthGuard, PLAN_CAPABILITIES, type UserContext } from '../tenancy/tenant-context.js';
import { filterModelsForUser } from './auth-guard.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeCtx(overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: 'user-abc',
    email: 'test@example.com',
    plan: 'starter',
    capabilities: PLAN_CAPABILITIES.starter,
    usage: {
      messagesThisPeriod: 0,
      activeChannels: 0,
      activeAgents: 0,
      storageBytes: 0,
    },
    subscription: {
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86400_000).toISOString(),
      cancelAtPeriodEnd: false,
    },
    ...overrides,
  };
}

// ── createAuthGuard tests ─────────────────────────────────────────────────────
describe('createAuthGuard', () => {
  describe('assertOwns', () => {
    it('passes when resource.userId matches ctx.userId', () => {
      const guard = createAuthGuard(makeCtx({ userId: 'user-abc' }));
      expect(() => guard.assertOwns({ userId: 'user-abc' })).not.toThrow();
    });

    it('throws 403 when resource.userId does not match', () => {
      const guard = createAuthGuard(makeCtx({ userId: 'user-abc' }));
      expect(() => guard.assertOwns({ userId: 'user-xyz' })).toThrow('Forbidden');
      try {
        guard.assertOwns({ userId: 'user-xyz' });
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  describe('canUseModel', () => {
    it('returns true for models included in plan capabilities', () => {
      const guard = createAuthGuard(makeCtx());
      // starter plan includes gemini-2.0-flash
      expect(guard.canUseModel('gemini-2.0-flash')).toBe(true);
    });

    it('returns false for models not in plan capabilities', () => {
      const guard = createAuthGuard(makeCtx());
      // starter does not include gpt-4o
      expect(guard.canUseModel('gpt-4o')).toBe(false);
    });

    it('enterprise plan allows all configured models', () => {
      const guard = createAuthGuard(makeCtx({ plan: 'enterprise', capabilities: PLAN_CAPABILITIES.enterprise }));
      for (const model of PLAN_CAPABILITIES.enterprise.models) {
        expect(guard.canUseModel(model)).toBe(true);
      }
    });
  });

  describe('canStartChannel', () => {
    it('returns true when under channel limit', () => {
      const guard = createAuthGuard(makeCtx({ usage: { messagesThisPeriod: 0, activeChannels: 0, activeAgents: 0, storageBytes: 0 } }));
      expect(guard.canStartChannel()).toBe(true);
    });

    it('returns false when at channel limit', () => {
      const starterMaxChannels = PLAN_CAPABILITIES.starter.maxChannels; // 3
      const guard = createAuthGuard(makeCtx({
        usage: { messagesThisPeriod: 0, activeChannels: starterMaxChannels, activeAgents: 0, storageBytes: 0 },
      }));
      expect(guard.canStartChannel()).toBe(false);
    });

    it('returns true for enterprise (maxChannels = -1 = unlimited)', () => {
      const guard = createAuthGuard(makeCtx({
        plan: 'enterprise',
        capabilities: PLAN_CAPABILITIES.enterprise,
        usage: { messagesThisPeriod: 0, activeChannels: 9999, activeAgents: 0, storageBytes: 0 },
      }));
      expect(guard.canStartChannel()).toBe(true);
    });
  });

  describe('canCreateAgent', () => {
    it('returns true when under agent limit', () => {
      const guard = createAuthGuard(makeCtx());
      expect(guard.canCreateAgent()).toBe(true);
    });

    it('returns false when at agent limit', () => {
      const starterMaxAgents = PLAN_CAPABILITIES.starter.maxAgents; // 2
      const guard = createAuthGuard(makeCtx({
        usage: { messagesThisPeriod: 0, activeChannels: 0, activeAgents: starterMaxAgents, storageBytes: 0 },
      }));
      expect(guard.canCreateAgent()).toBe(false);
    });
  });

  describe('canSendMessage', () => {
    it('returns true when under message limit', () => {
      const guard = createAuthGuard(makeCtx({ usage: { messagesThisPeriod: 4999, activeChannels: 0, activeAgents: 0, storageBytes: 0 } }));
      expect(guard.canSendMessage()).toBe(true);
    });

    it('returns false when at or over message limit', () => {
      const guard = createAuthGuard(makeCtx({
        usage: { messagesThisPeriod: 5000, activeChannels: 0, activeAgents: 0, storageBytes: 0 },
      }));
      expect(guard.canSendMessage()).toBe(false);
    });

    it('returns true for enterprise (maxMessagesPerMonth = -1 = unlimited)', () => {
      const guard = createAuthGuard(makeCtx({
        plan: 'enterprise',
        capabilities: PLAN_CAPABILITIES.enterprise,
        usage: { messagesThisPeriod: 999999, activeChannels: 0, activeAgents: 0, storageBytes: 0 },
      }));
      expect(guard.canSendMessage()).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('returns true for features enabled on the plan', () => {
      const guard = createAuthGuard(makeCtx()); // starter
      expect(guard.hasFeature('campaigns')).toBe(true);
      expect(guard.hasFeature('antiBan')).toBe(true);
    });

    it('returns false for features disabled on the plan', () => {
      const guard = createAuthGuard(makeCtx()); // starter
      expect(guard.hasFeature('aiSpinning')).toBe(false);
      expect(guard.hasFeature('customTools')).toBe(false);
    });

    it('free plan has no premium features', () => {
      const guard = createAuthGuard(makeCtx({ plan: 'free', capabilities: PLAN_CAPABILITIES.free }));
      expect(guard.hasFeature('campaigns')).toBe(false);
      expect(guard.hasFeature('antiBan')).toBe(false);
    });
  });
});

// ── filterModelsForUser tests ─────────────────────────────────────────────────
describe('filterModelsForUser', () => {
  it('returns only models present in both the plan and the config', () => {
    const ctx = makeCtx(); // starter: gemini-2.0-flash, gemini-2.5-flash
    const configuredModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gpt-4o', 'claude-sonnet-4-20250514'];
    const result = filterModelsForUser(ctx, configuredModels);
    expect(result).toEqual(['gemini-2.0-flash', 'gemini-2.5-flash']);
  });

  it('returns empty array when no overlap between plan and config', () => {
    const ctx = makeCtx({ plan: 'free', capabilities: PLAN_CAPABILITIES.free });
    // free plan only has gemini-2.0-flash, but config has only pro models
    const configuredModels = ['gpt-4o', 'claude-sonnet-4-20250514'];
    const result = filterModelsForUser(ctx, configuredModels);
    expect(result).toEqual([]);
  });

  it('returns all configured models for enterprise (unlimited plan)', () => {
    const ctx = makeCtx({ plan: 'enterprise', capabilities: PLAN_CAPABILITIES.enterprise });
    const configuredModels = ['gemini-2.0-flash', 'gpt-4o', 'claude-sonnet-4-20250514', 'gpt-4.1'];
    const result = filterModelsForUser(ctx, configuredModels);
    // enterprise allows all 4 configured models
    expect(result).toHaveLength(4);
  });

  it('preserves the order of the configured models list', () => {
    const ctx = makeCtx({ plan: 'pro', capabilities: PLAN_CAPABILITIES.pro });
    const configuredModels = ['gpt-4o', 'gemini-2.5-pro', 'gemini-2.0-flash'];
    const result = filterModelsForUser(ctx, configuredModels);
    expect(result).toEqual(['gpt-4o', 'gemini-2.5-pro', 'gemini-2.0-flash']);
  });
});
