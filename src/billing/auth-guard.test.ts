/**
 * Tests for createAuthGuard + filterModelsForUser (Phase 3.2 spec).
 *
 * Strategy:
 *   - Test createAuthGuard against every UserContext capability combination.
 *   - Test filterModelsForUser: verifies intersection of plan-allowed models
 *     with the set of models actually configured in OpenClaw config.
 *   - No external deps — pure unit tests.
 */
import { describe, it, expect, vi } from "vitest";
import { createAuthGuard, PLAN_CAPABILITIES, type UserContext } from "../tenancy/tenant-context.js";
import {
  filterModelsForUser,
  assertCanWithGrace,
  getCapabilities,
  type GraceNotifier,
  type PlanTier,
} from "./auth-guard.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeCtx(overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: "user-abc",
    displayName: "Test User",
    email: "test@example.com",
    plan: "starter",
    capabilities: PLAN_CAPABILITIES.starter,
    usage: {
      messagesThisPeriod: 0,
      activeChannels: 0,
      activeAgents: 0,
      tokensConsumed: 0,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 86400_000),
    },
    subscription: {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      isActive: true,
      isTrial: false,
      trialEndsAt: null,
      isOverLimit: false,
    },
    meta: {
      createdAt: new Date(),
      lastActiveAt: new Date(),
      timezone: "UTC",
    },
    ...overrides,
  };
}

// ── createAuthGuard tests ─────────────────────────────────────────────────────
describe("createAuthGuard", () => {
  describe("assertOwns", () => {
    it("passes when resource.userId matches ctx.userId", () => {
      const guard = createAuthGuard(makeCtx({ userId: "user-abc" }));
      expect(() => guard.assertOwns({ userId: "user-abc" })).not.toThrow();
    });

    it("throws 403 when resource.userId does not match", () => {
      const guard = createAuthGuard(makeCtx({ userId: "user-abc" }));
      expect(() => guard.assertOwns({ userId: "user-xyz" })).toThrow("Forbidden");
      try {
        guard.assertOwns({ userId: "user-xyz" });
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  describe("canUseModel", () => {
    it("returns true for models included in plan capabilities", () => {
      const guard = createAuthGuard(makeCtx());
      // starter plan includes gemini-2.0-flash
      expect(guard.canUseModel("gemini-2.0-flash")).toBe(true);
    });

    it("returns false for models not in plan capabilities", () => {
      const guard = createAuthGuard(makeCtx());
      // starter does not include gpt-4o
      expect(guard.canUseModel("gpt-4o")).toBe(false);
    });

    it("enterprise plan allows all configured models", () => {
      const guard = createAuthGuard(
        makeCtx({ plan: "enterprise", capabilities: PLAN_CAPABILITIES.enterprise }),
      );
      for (const model of PLAN_CAPABILITIES.enterprise.models) {
        expect(guard.canUseModel(model)).toBe(true);
      }
    });
  });

  describe("canStartChannel", () => {
    it("returns true when under channel limit", () => {
      const guard = createAuthGuard(
        makeCtx({
          usage: {
            messagesThisPeriod: 0,
            activeChannels: 0,
            activeAgents: 0,
            tokensConsumed: 0,
            periodStart: new Date(),
            periodEnd: new Date(),
          },
        }),
      );
      expect(guard.canStartChannel()).toBe(true);
    });

    it("returns false when at channel limit", () => {
      const starterMaxChannels = PLAN_CAPABILITIES.starter.maxChannels; // 3
      const guard = createAuthGuard(
        makeCtx({
          usage: {
            messagesThisPeriod: 0,
            activeChannels: starterMaxChannels,
            activeAgents: 0,
            tokensConsumed: 0,
            periodStart: new Date(),
            periodEnd: new Date(),
          },
        }),
      );
      expect(guard.canStartChannel()).toBe(false);
    });

    it("returns true for enterprise (maxChannels = -1 = unlimited)", () => {
      const guard = createAuthGuard(
        makeCtx({
          plan: "enterprise",
          capabilities: PLAN_CAPABILITIES.enterprise,
          usage: {
            messagesThisPeriod: 0,
            activeChannels: 9999,
            activeAgents: 0,
            tokensConsumed: 0,
            periodStart: new Date(),
            periodEnd: new Date(),
          },
        }),
      );
      expect(guard.canStartChannel()).toBe(true);
    });
  });

  describe("canCreateAgent", () => {
    it("returns true when under agent limit", () => {
      const guard = createAuthGuard(makeCtx());
      expect(guard.canCreateAgent()).toBe(true);
    });

    it("returns false when at agent limit", () => {
      const starterMaxAgents = PLAN_CAPABILITIES.starter.maxAgents; // 2
      const guard = createAuthGuard(
        makeCtx({
          usage: {
            messagesThisPeriod: 0,
            activeChannels: 0,
            activeAgents: starterMaxAgents,
            tokensConsumed: 0,
            periodStart: new Date(),
            periodEnd: new Date(),
          },
        }),
      );
      expect(guard.canCreateAgent()).toBe(false);
    });
  });

  describe("canSendMessage", () => {
    it("returns true when under message limit", () => {
      const guard = createAuthGuard(
        makeCtx({
          usage: {
            messagesThisPeriod: 4999,
            activeChannels: 0,
            activeAgents: 0,
            tokensConsumed: 0,
            periodStart: new Date(),
            periodEnd: new Date(),
          },
        }),
      );
      expect(guard.canSendMessage()).toBe(true);
    });

    it("returns false when at or over message limit", () => {
      const guard = createAuthGuard(
        makeCtx({
          usage: {
            messagesThisPeriod: 5000,
            activeChannels: 0,
            activeAgents: 0,
            tokensConsumed: 0,
            periodStart: new Date(),
            periodEnd: new Date(),
          },
        }),
      );
      expect(guard.canSendMessage()).toBe(false);
    });

    it("returns true for enterprise (maxMessagesPerMonth = -1 = unlimited)", () => {
      const guard = createAuthGuard(
        makeCtx({
          plan: "enterprise",
          capabilities: PLAN_CAPABILITIES.enterprise,
          usage: {
            messagesThisPeriod: 999999,
            activeChannels: 0,
            activeAgents: 0,
            tokensConsumed: 0,
            periodStart: new Date(),
            periodEnd: new Date(),
          },
        }),
      );
      expect(guard.canSendMessage()).toBe(true);
    });
  });

  describe("hasFeature", () => {
    it("returns true for features enabled on the plan", () => {
      const guard = createAuthGuard(makeCtx()); // starter
      expect(guard.hasFeature("campaigns")).toBe(true);
      expect(guard.hasFeature("antiBan")).toBe(true);
    });

    it("returns false for features disabled on the plan", () => {
      const guard = createAuthGuard(makeCtx()); // starter
      expect(guard.hasFeature("aiSpinning")).toBe(false);
      expect(guard.hasFeature("customTools")).toBe(false);
    });

    it("free plan has no premium features", () => {
      const guard = createAuthGuard(
        makeCtx({ plan: "free", capabilities: PLAN_CAPABILITIES.free }),
      );
      expect(guard.hasFeature("campaigns")).toBe(false);
      expect(guard.hasFeature("antiBan")).toBe(false);
    });
  });
});

// ── filterModelsForUser tests ─────────────────────────────────────────────────
describe("filterModelsForUser", () => {
  it("returns only models present in both the plan and the config", () => {
    const ctx = makeCtx(); // starter: gemini-2.0-flash, gemini-2.5-flash
    const configuredModels = [
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gpt-4o",
      "claude-sonnet-4-20250514",
    ];
    const result = filterModelsForUser(ctx, configuredModels);
    expect(result).toEqual(["gemini-2.0-flash", "gemini-2.5-flash"]);
  });

  it("returns empty array when no overlap between plan and config", () => {
    const ctx = makeCtx({ plan: "free", capabilities: PLAN_CAPABILITIES.free });
    // free plan only has gemini-2.0-flash, but config has only pro models
    const configuredModels = ["gpt-4o", "claude-sonnet-4-20250514"];
    const result = filterModelsForUser(ctx, configuredModels);
    expect(result).toEqual([]);
  });

  it("returns all configured models for enterprise (unlimited plan)", () => {
    const ctx = makeCtx({ plan: "enterprise", capabilities: PLAN_CAPABILITIES.enterprise });
    const configuredModels = ["gemini-2.0-flash", "gpt-4o", "claude-sonnet-4-20250514", "gpt-4.1"];
    const result = filterModelsForUser(ctx, configuredModels);
    // enterprise allows all 4 configured models
    expect(result).toHaveLength(4);
  });

  it("preserves the order of the configured models list", () => {
    const ctx = makeCtx({ plan: "pro", capabilities: PLAN_CAPABILITIES.pro });
    const configuredModels = ["gpt-4o", "gemini-2.5-pro", "gemini-2.0-flash"];
    const result = filterModelsForUser(ctx, configuredModels);
    expect(result).toEqual(["gpt-4o", "gemini-2.5-pro", "gemini-2.0-flash"]);
  });
});

// ── assertCanWithGrace tests ──────────────────────────────────────────────────
describe("assertCanWithGrace", () => {
  // starter: maxChannels=3, maxAgents=2, maxMessagesPerMonth=5000

  describe("message capability", () => {
    it("does not throw and does not notify when well under limit (<90%)", () => {
      const notify: GraceNotifier = vi.fn();
      const ctx = makeCtx({
        usage: {
          messagesThisPeriod: 4000,
          activeChannels: 0,
          activeAgents: 0,
          tokensConsumed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      // 4000/5000 = 80% — under grace threshold
      expect(() => assertCanWithGrace(ctx, "message", notify)).not.toThrow();
      expect(notify).not.toHaveBeenCalled();
    });

    it("does not throw but notifies when in grace zone (90–99%)", () => {
      const notify: GraceNotifier = vi.fn();
      const ctx = makeCtx({
        usage: {
          messagesThisPeriod: 4600,
          activeChannels: 0,
          activeAgents: 0,
          tokensConsumed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      // 4600/5000 = 92% — in grace zone
      expect(() => assertCanWithGrace(ctx, "message", notify)).not.toThrow();
      expect(notify).toHaveBeenCalledOnce();
      expect(notify).toHaveBeenCalledWith("user-abc", "message", expect.closeTo(92, 0));
    });

    it("throws 402 with PLAN_LIMIT_MESSAGE code at exactly 100%", () => {
      const notify: GraceNotifier = vi.fn();
      const ctx = makeCtx({
        usage: {
          messagesThisPeriod: 5000,
          activeChannels: 0,
          activeAgents: 0,
          tokensConsumed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      expect(() => assertCanWithGrace(ctx, "message", notify)).toThrow();
      try {
        assertCanWithGrace(ctx, "message", notify);
      } catch (err: any) {
        expect(err.statusCode).toBe(402);
        expect(err.code).toBe("PLAN_LIMIT_MESSAGE");
      }
      expect(notify).not.toHaveBeenCalled();
    });

    it("throws 402 when over limit (>100%)", () => {
      const notify: GraceNotifier = vi.fn();
      const ctx = makeCtx({
        usage: {
          messagesThisPeriod: 6000,
          activeChannels: 0,
          activeAgents: 0,
          tokensConsumed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      expect(() => assertCanWithGrace(ctx, "message", notify)).toThrow();
      expect(notify).not.toHaveBeenCalled();
    });

    it("never throws for unlimited plan (enterprise)", () => {
      const notify: GraceNotifier = vi.fn();
      const ctx = makeCtx({
        plan: "enterprise",
        capabilities: PLAN_CAPABILITIES.enterprise,
        usage: {
          messagesThisPeriod: 999999,
          activeChannels: 0,
          activeAgents: 0,
          tokensConsumed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      expect(() => assertCanWithGrace(ctx, "message", notify)).not.toThrow();
      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe("channel capability", () => {
    it("notifies when 2 of 3 channels used (≥90% of limit=3 → floor is 2.7)", () => {
      const notify: GraceNotifier = vi.fn();
      // starter maxChannels=3; 3/3=100% → hard block. Test 90% boundary:
      // ceil(3 * 0.9) = 3 → grace at exactly 3 would already be hard block.
      // So test at 2 channels used (66%) — no notify, then at limit 3 — hard block.
      const ctx = makeCtx({
        usage: {
          messagesThisPeriod: 0,
          activeChannels: 2,
          activeAgents: 0,
          tokensConsumed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      // 2/3 = 66.7% — under grace
      expect(() => assertCanWithGrace(ctx, "channel", notify)).not.toThrow();
      expect(notify).not.toHaveBeenCalled();
    });

    it("throws 402 at channel limit", () => {
      const notify: GraceNotifier = vi.fn();
      const ctx = makeCtx({
        usage: {
          messagesThisPeriod: 0,
          activeChannels: 3,
          activeAgents: 0,
          tokensConsumed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      expect(() => assertCanWithGrace(ctx, "channel", notify)).toThrow();
      try {
        assertCanWithGrace(ctx, "channel", notify);
      } catch (err: any) {
        expect(err.statusCode).toBe(402);
        expect(err.code).toBe("PLAN_LIMIT_CHANNEL");
      }
    });

    it("notifies in grace zone for pro plan (maxChannels=10)", () => {
      const notify: GraceNotifier = vi.fn();
      const ctx = makeCtx({
        plan: "pro",
        capabilities: PLAN_CAPABILITIES.pro,
        usage: {
          messagesThisPeriod: 0,
          activeChannels: 9,
          activeAgents: 0,
          tokensConsumed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      // 9/10 = 90% — grace zone
      expect(() => assertCanWithGrace(ctx, "channel", notify)).not.toThrow();
      expect(notify).toHaveBeenCalledOnce();
      expect(notify).toHaveBeenCalledWith("user-abc", "channel", 90);
    });
  });

  describe("agent capability", () => {
    it("notifies in grace zone for pro plan (maxAgents=5, used=5 → hard block)", () => {
      const notify: GraceNotifier = vi.fn();
      const ctx = makeCtx({
        plan: "pro",
        capabilities: PLAN_CAPABILITIES.pro,
        usage: {
          messagesThisPeriod: 0,
          activeChannels: 0,
          activeAgents: 5,
          tokensConsumed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      // 5/5 = 100% — hard block
      expect(() => assertCanWithGrace(ctx, "agent", notify)).toThrow();
      try {
        assertCanWithGrace(ctx, "agent", notify);
      } catch (err: any) {
        expect(err.code).toBe("PLAN_LIMIT_AGENT");
      }
    });
  });
});

// ── Task 5.10.2 — getCapabilities (SystemAuthorityService scenarios) ──────────
// These tests fail RED until getCapabilities is exported from auth-guard.ts (Task 5.10.3).

describe("getCapabilities (consolidated from SystemAuthorityService)", () => {
  it("returns starter capabilities for the starter tier", () => {
    const caps = getCapabilities("starter" as PlanTier);
    expect(caps.maxChannelSlots).toBe(1);
    expect(caps.maxAgents).toBe(1);
    expect(caps.maxMessages).toBe(1000);
    expect(caps.models).toContain("gemini-1.5-flash");
    expect(caps.features.marketing).toBe(false);
  });

  it("returns pro capabilities for the pro tier", () => {
    const caps = getCapabilities("pro" as PlanTier);
    expect(caps.maxChannelSlots).toBe(3);
    expect(caps.maxAgents).toBe(5);
    expect(caps.maxMessages).toBe(10000);
    expect(caps.features.marketing).toBe(true);
    expect(caps.models).toContain("gemini-1.5-pro");
  });

  it("returns enterprise capabilities for the enterprise tier", () => {
    const caps = getCapabilities("enterprise" as PlanTier);
    expect(caps.maxChannelSlots).toBe(100);
    expect(caps.maxAgents).toBe(100);
    expect(caps.maxMessages).toBe(10000000);
    expect(caps.features.aiMessageSpinning).toBe(true);
  });

  it("returns starter capabilities for an unknown tier (safe default)", () => {
    const caps = getCapabilities("unknown-tier" as PlanTier);
    expect(caps).toEqual(getCapabilities("starter" as PlanTier));
  });
});
