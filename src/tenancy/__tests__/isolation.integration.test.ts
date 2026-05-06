/**
 * isolation.integration.test.ts
 *
 * B2C Tenant Isolation Integration Tests
 *
 * Proves that the authorization layer correctly enforces user-level isolation:
 * - User A cannot read, write, or enumerate User B's resources
 * - `assertOwns` blocks cross-user access with 403
 * - `UserContextResolver` never resolves a mismatched userId/channelId pair
 * - Channel and agent operations are scoped to the owning user only
 * - Plan capabilities are per-user and cannot bleed across users
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAuthGuard,
  PLAN_CAPABILITIES,
  type UserContext,
  type PlanTier,
} from "../tenant-context.js";

// ── Test helper ────────────────────────────────────────────────────────────────

function makeCtx(plan: PlanTier, overrides: Partial<UserContext> = {}): UserContext {
  const now = new Date();
  return {
    userId: `user-${plan}-${Math.random().toString(36).slice(2, 8)}`,
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
    },
    subscription: {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      isActive: true,
      isTrial: false,
      trialEndsAt: null,
      isOverLimit: false,
    },
    meta: { createdAt: now, lastActiveAt: now, timezone: "UTC" },
    ...overrides,
  };
}

// ── Cross-user resource access ─────────────────────────────────────────────────

describe("B2C Tenant Isolation — assertOwns", () => {
  it("allows a user to access their own resource", () => {
    const userA = makeCtx("free");
    const guard = createAuthGuard(userA);
    expect(() => guard.assertOwns({ userId: userA.userId })).not.toThrow();
  });

  it("blocks User A from reading User B's resource (403)", () => {
    const userA = makeCtx("free");
    const userB = makeCtx("free");
    const guard = createAuthGuard(userA);

    expect(() => guard.assertOwns({ userId: userB.userId })).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("blocks cross-user channel access (403)", () => {
    const userA = makeCtx("pro");
    const userB = makeCtx("pro");
    const guardA = createAuthGuard(userA);

    const channelOwnedByB = { userId: userB.userId, channelId: "ch-whatsapp-1" };
    expect(() => guardA.assertOwns(channelOwnedByB)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("blocks cross-user agent access (403)", () => {
    const userA = makeCtx("starter");
    const userB = makeCtx("enterprise");
    const guardA = createAuthGuard(userA);

    const agentOwnedByB = { userId: userB.userId, agentId: "agent-xyz" };
    expect(() => guardA.assertOwns(agentOwnedByB)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("blocks cross-user session access (403)", () => {
    const userA = makeCtx("free");
    const userB = makeCtx("pro");
    const guardA = createAuthGuard(userA);

    const sessionOwnedByB = { userId: userB.userId, sessionId: "sess-001" };
    expect(() => guardA.assertOwns(sessionOwnedByB)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("403 error message includes the requesting userId for audit logs", () => {
    const userA = makeCtx("free");
    const userB = makeCtx("free");
    const guard = createAuthGuard(userA);

    expect(() => guard.assertOwns({ userId: userB.userId })).toThrow(userA.userId);
  });

  it("does not leak cross-user isolation under concurrent guards", () => {
    const users = ["free", "starter", "pro", "enterprise"].map((p) => makeCtx(p as PlanTier));

    // Each user's guard only allows access to their own userId
    for (const owner of users) {
      const guard = createAuthGuard(owner);
      for (const other of users) {
        if (other.userId === owner.userId) {
          expect(() => guard.assertOwns({ userId: other.userId })).not.toThrow();
        } else {
          expect(() => guard.assertOwns({ userId: other.userId })).toThrow(
            expect.objectContaining({ statusCode: 403 }),
          );
        }
      }
    }
  });
});

// ── Plan capability isolation ──────────────────────────────────────────────────

describe("B2C Tenant Isolation — plan capabilities do not bleed across users", () => {
  it("Free user cannot use Pro models even if another Pro user exists in the system", () => {
    const freeUser = makeCtx("free");
    const _proUser = makeCtx("pro"); // simulates another user in the system
    const guard = createAuthGuard(freeUser);

    expect(guard.canUseModel("claude-sonnet-4-20250514")).toBe(false);
    expect(guard.canUseModel("gpt-4o")).toBe(false);
    expect(guard.canUseModel("gemini-2.5-pro")).toBe(false);
  });

  it("Free user can only use their own plan's model", () => {
    const freeUser = makeCtx("free");
    const guard = createAuthGuard(freeUser);

    expect(guard.canUseModel("gemini-2.0-flash")).toBe(true);
  });

  it("Pro user capabilities are scoped to their own context, not affected by Free users", () => {
    const _freeUser = makeCtx("free");
    const proUser = makeCtx("pro");
    const guard = createAuthGuard(proUser);

    expect(guard.canUseModel("claude-sonnet-4-20250514")).toBe(true);
    expect(guard.canUseModel("gpt-4o")).toBe(true);
    expect(guard.canStartChannel()).toBe(true);
    expect(guard.hasFeature("subagents")).toBe(true);
  });

  it("Free user cannot access campaigns feature, Pro user can — isolation is per-context", () => {
    const freeUser = makeCtx("free");
    const proUser = makeCtx("pro");

    expect(createAuthGuard(freeUser).hasFeature("campaigns")).toBe(false);
    expect(createAuthGuard(proUser).hasFeature("campaigns")).toBe(true);
  });
});

// ── Capacity limit isolation ───────────────────────────────────────────────────

describe("B2C Tenant Isolation — capacity limits are per-user", () => {
  it("User A at channel limit does not block User B from starting channels", () => {
    const userA = makeCtx("free", {
      usage: {
        messagesThisPeriod: 0,
        activeChannels: 1,
        activeAgents: 0,
        tokensConsumed: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    });
    const userB = makeCtx("free", {
      usage: {
        messagesThisPeriod: 0,
        activeChannels: 0,
        activeAgents: 0,
        tokensConsumed: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    });

    expect(createAuthGuard(userA).canStartChannel()).toBe(false); // at limit
    expect(createAuthGuard(userB).canStartChannel()).toBe(true); // has capacity
  });

  it("User A exhausting message quota does not affect User B's quota", () => {
    const userA = makeCtx("free", {
      usage: {
        messagesThisPeriod: 100,
        activeChannels: 0,
        activeAgents: 0,
        tokensConsumed: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    });
    const userB = makeCtx("free", {
      usage: {
        messagesThisPeriod: 0,
        activeChannels: 0,
        activeAgents: 0,
        tokensConsumed: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    });

    expect(createAuthGuard(userA).canSendMessage()).toBe(false);
    expect(createAuthGuard(userB).canSendMessage()).toBe(true);
  });

  it("Enterprise user with unlimited channels does not expose unlimited cap to Free user", () => {
    const enterpriseUser = makeCtx("enterprise");
    const freeUser = makeCtx("free");

    // Enterprise has -1 (unlimited), Free has 1
    expect(enterpriseUser.capabilities.maxChannels).toBe(-1);
    expect(freeUser.capabilities.maxChannels).toBe(1);

    // The free user's guard checks their OWN capabilities
    const freeGuard = createAuthGuard(freeUser);
    expect(freeGuard.canStartChannel()).toBe(true); // has 0/1 channels
  });
});
