/**
 * Task 5.1 — TenantContext injection into PluginRuntime
 *
 * RED phase: these tests FAIL until userId is added to ChannelManagerOptions
 * and threaded through ChannelGatewayContext.
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

function makeOpts(userId?: string) {
  const log = createSubsystemLogger("test");
  const channelLogs = { discord: log } as Record<ChannelId, SubsystemLogger>;
  const runtime = runtimeForLogger(log);
  const channelRuntimeEnvs = { discord: runtime } as Record<ChannelId, RuntimeEnv>;
  return {
    loadConfig: () => ({}),
    channelLogs,
    channelRuntimeEnvs,
    userId,
  };
}

describe("Task 5.1 — TenantContext propagation in PluginRuntime", () => {
  it("threads userId through to startAccount context when provided", async () => {
    const capturedCtx: unknown[] = [];
    const startAccount = vi.fn(async (ctx: unknown) => {
      capturedCtx.push(ctx);
    });

    installTestRegistry(createTestPlugin(startAccount));
    const manager = createChannelManager(makeOpts("user-001"));

    await manager.startChannel("discord" as ChannelId);

    expect(startAccount).toHaveBeenCalledTimes(1);
    expect(capturedCtx[0]).toMatchObject({ userId: "user-001" });
  });

  it("startAccount context has no userId when manager created without one", async () => {
    const capturedCtx: unknown[] = [];
    const startAccount = vi.fn(async (ctx: unknown) => {
      capturedCtx.push(ctx);
    });

    installTestRegistry(createTestPlugin(startAccount));
    const manager = createChannelManager(makeOpts(/* no userId */));

    await manager.startChannel("discord" as ChannelId);

    expect(startAccount).toHaveBeenCalledTimes(1);
    const ctx = capturedCtx[0] as Record<string, unknown>;
    // userId should be absent or undefined — not a stale value from a prior user
    expect(ctx["userId"]).toBeUndefined();
  });

  it("stopAccount context also receives userId", async () => {
    const capturedStopCtx: unknown[] = [];
    const stopAccount = vi.fn(async (ctx: unknown) => {
      capturedStopCtx.push(ctx);
    });
    const startAccount = vi.fn(async () => {});

    installTestRegistry({
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
      gateway: { startAccount, stopAccount },
    } as ChannelPlugin<TestAccount>);

    const manager = createChannelManager(makeOpts("user-002"));
    await manager.startChannel("discord" as ChannelId);
    await manager.stopChannel("discord" as ChannelId);

    expect(stopAccount).toHaveBeenCalledTimes(1);
    expect(capturedStopCtx[0]).toMatchObject({ userId: "user-002" });
  });
});
