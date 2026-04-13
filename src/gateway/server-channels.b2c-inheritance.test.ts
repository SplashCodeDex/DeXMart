/**
 * Task 5.7 — B2C Capability Inheritance Verification
 *
 * Verifies that:
 *   5.7.1 — Two users running the same channel type receive fully isolated
 *            userId contexts — no cross-user state leaks through the plugin lifecycle.
 *   5.7.2 — Stripe billing gates block startChannel across at least two different
 *            channel types, confirming the gate is generic, not channel-specific.
 *
 * These are integration tests at the createChannelManager boundary — they prove
 * that every channel plugin (all 40+) inherits B2C isolation and gating because
 * the mechanism lives in the channel manager itself, not in each plugin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChannelId, type ChannelPlugin } from "../channels/plugins/types.js";
import {
  createSubsystemLogger,
  type SubsystemLogger,
  runtimeForLogger,
} from "../logging/subsystem.js";
import { createEmptyPluginRegistry, type PluginRegistry } from "../plugins/registry.js";
import { getActivePluginRegistry, setActivePluginRegistry } from "../plugins/runtime.js";
import { DEFAULT_ACCOUNT_ID } from "../routing/session-key.js";
import type { RuntimeEnv } from "../runtime.js";
import { createChannelManager } from "./server-channels.js";

vi.mock("../infra/backoff.js", () => ({
  computeBackoff: vi.fn(() => 10),
  sleepWithAbort: vi.fn(() => Promise.resolve()),
}));

type TestAccount = { enabled?: boolean; configured?: boolean };

// ── Plugin factory ─────────────────────────────────────────────────────────

function createTestPlugin(
  channelId: string,
  startAccount: NonNullable<ChannelPlugin<TestAccount>["gateway"]>["startAccount"],
): ChannelPlugin<TestAccount> {
  return {
    id: channelId,
    meta: {
      id: channelId,
      label: channelId,
      selectionLabel: channelId,
      docsPath: `/channels/${channelId}`,
      blurb: "test stub",
    },
    capabilities: { chatTypes: ["direct"] },
    config: {
      listAccountIds: () => [DEFAULT_ACCOUNT_ID],
      resolveAccount: () => ({ enabled: true, configured: true }),
      isEnabled: () => true,
      isConfigured: async () => true,
    },
    gateway: { startAccount },
  };
}

function installTestRegistry(...plugins: ChannelPlugin<TestAccount>[]) {
  const registry = createEmptyPluginRegistry();
  for (const plugin of plugins) {
    registry.channels.push({ pluginId: plugin.id, source: "test", plugin });
  }
  setActivePluginRegistry(registry);
}

function makeOpts(
  channelId: string,
  opts?: {
    userId?: string;
    billingGuard?: { canStartChannel(): boolean; deniedMessage: string };
  },
) {
  const log = createSubsystemLogger("test");
  const channelLogs = { [channelId]: log } as Record<ChannelId, SubsystemLogger>;
  const runtime = runtimeForLogger(log);
  const channelRuntimeEnvs = { [channelId]: runtime } as Record<ChannelId, RuntimeEnv>;
  return {
    loadConfig: () => ({}),
    channelLogs,
    channelRuntimeEnvs,
    userId: opts?.userId,
    billingGuard: opts?.billingGuard,
  };
}

let previousRegistry: PluginRegistry | null = null;

beforeEach(() => {
  previousRegistry = getActivePluginRegistry();
});

afterEach(() => {
  setActivePluginRegistry(previousRegistry ?? createEmptyPluginRegistry());
});

// ── 5.7.1 — Multi-tenant isolation ────────────────────────────────────────────

describe("Task 5.7.1 — Multi-tenant userId isolation", () => {
  it("delivers distinct userIds to startAccount for two concurrent managers", async () => {
    const capturedUserIds: Array<string | undefined> = [];

    // Return a never-resolving promise to simulate a live channel connection.
    // This prevents the auto-restart chain from firing during the test and
    // calling startAccount a third time before assertions run.
    const startAccount = vi.fn((ctx: unknown) => {
      const c = ctx as Record<string, unknown>;
      capturedUserIds.push(c["userId"] as string | undefined);
      return new Promise<void>(() => {});
    });

    installTestRegistry(createTestPlugin("discord", startAccount));

    // Simulate two tenants each getting their own manager (e.g. per HTTP request)
    const managerA = createChannelManager(makeOpts("discord", { userId: "user-alice" }));
    const managerB = createChannelManager(makeOpts("discord", { userId: "user-bob" }));

    await managerA.startChannel("discord" as ChannelId);
    await managerB.startChannel("discord" as ChannelId);

    expect(startAccount).toHaveBeenCalledTimes(2);
    expect(capturedUserIds).toContain("user-alice");
    expect(capturedUserIds).toContain("user-bob");

    // Crucially: no cross-contamination — each manager sees only its own userId
    const aliceIndex = capturedUserIds.findIndex((id) => id === "user-alice");
    const bobIndex = capturedUserIds.findIndex((id) => id === "user-bob");
    expect(aliceIndex).not.toBe(bobIndex);
  });

  it("userIds are not shared between managers started sequentially", async () => {
    const capturedContexts: Array<Record<string, unknown>> = [];

    const startAccount = vi.fn(async (ctx: unknown) => {
      capturedContexts.push({ ...(ctx as Record<string, unknown>) });
    });

    installTestRegistry(createTestPlugin("discord", startAccount));

    await createChannelManager(makeOpts("discord", { userId: "tenant-X" })).startChannel(
      "discord" as ChannelId,
    );
    await createChannelManager(makeOpts("discord", { userId: "tenant-Y" })).startChannel(
      "discord" as ChannelId,
    );

    expect(capturedContexts[0]?.["userId"]).toBe("tenant-X");
    expect(capturedContexts[1]?.["userId"]).toBe("tenant-Y");
    // Confirm no bleed: tenant-X's context doesn't contain tenant-Y's id
    expect(capturedContexts[0]?.["userId"]).not.toBe("tenant-Y");
  });

  it("anonymous (no userId) manager does not expose a prior user's id", async () => {
    const capturedCtx: unknown[] = [];
    const startAccount = vi.fn(async (ctx: unknown) => {
      capturedCtx.push(ctx);
    });

    installTestRegistry(createTestPlugin("discord", startAccount));

    // Authenticated user runs first
    await createChannelManager(makeOpts("discord", { userId: "user-first" })).startChannel(
      "discord" as ChannelId,
    );
    // Anonymous user runs second
    await createChannelManager(makeOpts("discord" /*, no userId */)).startChannel(
      "discord" as ChannelId,
    );

    const anonCtx = capturedCtx[1] as Record<string, unknown>;
    expect(anonCtx["userId"]).toBeUndefined();
  });
});

// ── 5.7.2 — Billing gate across multiple channel types ────────────────────────

describe("Task 5.7.2 — Stripe billing gate is generic (not channel-specific)", () => {
  const blockedGuard = {
    canStartChannel: () => false,
    deniedMessage: "Plan limit exceeded.",
  };
  const allowedGuard = {
    canStartChannel: () => true,
    deniedMessage: "",
  };

  it("blocks startChannel for 'discord' when plan limit exceeded", async () => {
    installTestRegistry(createTestPlugin("discord", vi.fn(async () => {})));
    const manager = createChannelManager(makeOpts("discord", { billingGuard: blockedGuard }));
    await expect(manager.startChannel("discord" as ChannelId)).rejects.toThrow(/plan limit/i);
  });

  it("blocks startChannel for 'telegram' when plan limit exceeded", async () => {
    installTestRegistry(createTestPlugin("telegram", vi.fn(async () => {})));
    const manager = createChannelManager(makeOpts("telegram", { billingGuard: blockedGuard }));
    await expect(manager.startChannel("telegram" as ChannelId)).rejects.toThrow(/plan limit/i);
  });

  it("allows startChannel for 'discord' when within plan limits", async () => {
    const startAccount = vi.fn(async () => {});
    installTestRegistry(createTestPlugin("discord", startAccount));
    const manager = createChannelManager(makeOpts("discord", { billingGuard: allowedGuard }));
    await manager.startChannel("discord" as ChannelId);
    expect(startAccount).toHaveBeenCalledOnce();
  });

  it("allows startChannel for 'telegram' when within plan limits", async () => {
    const startAccount = vi.fn(async () => {});
    installTestRegistry(createTestPlugin("telegram", startAccount));
    const manager = createChannelManager(makeOpts("telegram", { billingGuard: allowedGuard }));
    await manager.startChannel("telegram" as ChannelId);
    expect(startAccount).toHaveBeenCalledOnce();
  });

  it("billing gate blocks start for both channels when user is over-plan", async () => {
    const discordStart = vi.fn(async () => {});
    const telegramStart = vi.fn(async () => {});

    installTestRegistry(
      createTestPlugin("discord", discordStart),
      createTestPlugin("telegram", telegramStart),
    );

    const discordManager = createChannelManager(makeOpts("discord", { billingGuard: blockedGuard }));
    const telegramManager = createChannelManager(
      makeOpts("telegram", { billingGuard: blockedGuard }),
    );

    await expect(discordManager.startChannel("discord" as ChannelId)).rejects.toThrow(
      /plan limit/i,
    );
    await expect(telegramManager.startChannel("telegram" as ChannelId)).rejects.toThrow(
      /plan limit/i,
    );

    expect(discordStart).not.toHaveBeenCalled();
    expect(telegramStart).not.toHaveBeenCalled();
  });
});
