/**
 * Task 5.3 — Stripe billing gates in channel startup
 *
 * RED phase: tests fail until ChannelManagerOptions accepts a billingGuard
 * and startChannelInternal enforces it before booting any plugin.
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

function createTestPlugin(
  startAccount: NonNullable<ChannelPlugin<TestAccount>["gateway"]>["startAccount"],
): ChannelPlugin<TestAccount> {
  return {
    id: "discord",
    meta: {
      id: "discord",
      label: "Discord",
      selectionLabel: "Discord",
      docsPath: "/channels/discord",
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

function installTestRegistry(plugin: ChannelPlugin<TestAccount>) {
  const registry = createEmptyPluginRegistry();
  registry.channels.push({ pluginId: plugin.id, source: "test", plugin });
  setActivePluginRegistry(registry);
}

let previousRegistry: PluginRegistry | null = null;

beforeEach(() => {
  previousRegistry = getActivePluginRegistry();
});

afterEach(() => {
  setActivePluginRegistry(previousRegistry ?? createEmptyPluginRegistry());
});

function makeOpts(billingGuard?: { canStartChannel(): boolean; deniedMessage: string }) {
  const log = createSubsystemLogger("test");
  const channelLogs = { discord: log } as Record<ChannelId, SubsystemLogger>;
  const runtime = runtimeForLogger(log);
  const channelRuntimeEnvs = { discord: runtime } as Record<ChannelId, RuntimeEnv>;
  return {
    loadConfig: () => ({}),
    channelLogs,
    channelRuntimeEnvs,
    billingGuard,
  };
}

describe("Task 5.3 — Billing gate in startChannelInternal", () => {
  it("blocks startAccount when billingGuard.canStartChannel() returns false", async () => {
    const startAccount = vi.fn(async () => {});
    installTestRegistry(createTestPlugin(startAccount));

    const manager = createChannelManager(
      makeOpts({
        canStartChannel: () => false,
        deniedMessage: "Channel limit reached for your plan.",
      }),
    );

    await expect(manager.startChannel("discord" as ChannelId)).rejects.toThrow(/channel limit/i);
    expect(startAccount).not.toHaveBeenCalled();
  });

  it("allows startAccount when billingGuard.canStartChannel() returns true", async () => {
    const startAccount = vi.fn(async () => {});
    installTestRegistry(createTestPlugin(startAccount));

    const manager = createChannelManager(
      makeOpts({ canStartChannel: () => true, deniedMessage: "" }),
    );

    await manager.startChannel("discord" as ChannelId);
    expect(startAccount).toHaveBeenCalledTimes(1);
  });

  it("allows startAccount when no billingGuard provided (CLI / single-user mode)", async () => {
    const startAccount = vi.fn(async () => {});
    installTestRegistry(createTestPlugin(startAccount));

    const manager = createChannelManager(makeOpts(/* no guard */));

    await manager.startChannel("discord" as ChannelId);
    expect(startAccount).toHaveBeenCalledTimes(1);
  });

  it("thrown error has HTTP 402 status code", async () => {
    const startAccount = vi.fn(async () => {});
    installTestRegistry(createTestPlugin(startAccount));

    const manager = createChannelManager(
      makeOpts({ canStartChannel: () => false, deniedMessage: "limit" }),
    );

    let caught: unknown;
    try {
      await manager.startChannel("discord" as ChannelId);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect((caught as { statusCode?: number }).statusCode).toBe(402);
  });
});
