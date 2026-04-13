/**
 * Task 5.6.1 — Failing test: memoryManager propagation through createOpenClawTools.
 *
 * Verifies that when a MemorySearchManager (e.g. HybridMemoryAdapter) is provided
 * to createOpenClawTools, it is forwarded to resolvePluginTools so the memory-core
 * plugin can inject it into createMemorySearchTool / createMemoryGetTool.
 *
 * This test FAILS before Task 5.6.3 is implemented and PASSES after.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemorySearchManager, MemorySearchResult } from "../memory/types.js";

// ── Capture resolvePluginTools calls ─────────────────────────────────────────
type CapturedPluginToolsCall = Parameters<typeof import("../plugins/tools.js").resolvePluginTools>[0];
const capturedCalls: CapturedPluginToolsCall[] = [];

vi.mock("../plugins/tools.js", () => ({
  resolvePluginTools: vi.fn((params: CapturedPluginToolsCall) => {
    capturedCalls.push(params);
    return [];
  }),
  getPluginToolMeta: vi.fn(() => undefined),
}));

// Mock heavy tool dependencies so the test stays fast
vi.mock("./tools/browser-tool.js", () => ({ createBrowserTool: () => ({ name: "browser", label: "browser", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/canvas-tool.js", () => ({ createCanvasTool: () => ({ name: "canvas", label: "canvas", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/cron-tool.js", () => ({ createCronTool: () => ({ name: "cron", label: "cron", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/gateway-tool.js", () => ({ createGatewayTool: () => ({ name: "gateway", label: "gateway", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/image-tool.js", () => ({ createImageTool: () => null }));
vi.mock("./tools/message-tool.js", () => ({ createMessageTool: () => ({ name: "message", label: "message", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/nodes-tool.js", () => ({ createNodesTool: () => ({ name: "nodes", label: "nodes", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/session-status-tool.js", () => ({ createSessionStatusTool: () => ({ name: "session_status", label: "session_status", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/sessions-history-tool.js", () => ({ createSessionsHistoryTool: () => ({ name: "sessions_history", label: "sessions_history", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/sessions-list-tool.js", () => ({ createSessionsListTool: () => ({ name: "sessions_list", label: "sessions_list", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/sessions-send-tool.js", () => ({ createSessionsSendTool: () => ({ name: "sessions_send", label: "sessions_send", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/sessions-spawn-tool.js", () => ({ createSessionsSpawnTool: () => ({ name: "sessions_spawn", label: "sessions_spawn", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/subagents-tool.js", () => ({ createSubagentsTool: () => ({ name: "subagents", label: "subagents", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/tts-tool.js", () => ({ createTtsTool: () => ({ name: "tts", label: "tts", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./tools/web-tools.js", () => ({
  createWebFetchTool: () => ({ name: "web_fetch", label: "web_fetch", description: "", parameters: {}, execute: async () => ({}) }),
  createWebSearchTool: () => ({ name: "web_search", label: "web_search", description: "", parameters: {}, execute: async () => ({}) }),
}));
vi.mock("./tools/agents-list-tool.js", () => ({ createAgentsListTool: () => ({ name: "agents_list", label: "agents_list", description: "", parameters: {}, execute: async () => ({}) }) }));
vi.mock("./workspace-dir.js", () => ({ resolveWorkspaceRoot: () => "/tmp/workspace" }));
vi.mock("./agent-scope.js", () => ({ resolveSessionAgentId: () => "main" }));

// Import after mocking
const { createOpenClawTools } = await import("./openclaw-tools.js");

// ── Minimal MemorySearchManager stub ─────────────────────────────────────────
function makeMemoryManager(): MemorySearchManager {
  return {
    search: vi.fn(async (): Promise<MemorySearchResult[]> => []),
    readFile: vi.fn(async () => ({ text: "", path: "" })),
    status: vi.fn(() => ({
      backend: "builtin" as const,
      provider: "mock",
      model: "mock",
      fallback: false,
    })),
    probeEmbeddingAvailability: vi.fn(async () => ({ available: false })),
    probeVectorAvailability: vi.fn(async () => false),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("createOpenClawTools — memoryManager propagation (Task 5.6.3)", () => {
  beforeEach(() => {
    capturedCalls.length = 0;
    vi.clearAllMocks();
  });

  it("forwards memoryManager to resolvePluginTools when provided", () => {
    const manager = makeMemoryManager();
    createOpenClawTools({ memoryManager: manager });

    expect(capturedCalls).toHaveLength(1);
    // This assertion FAILS before Task 5.6.3 is wired
    expect(capturedCalls[0]?.memoryManager).toBe(manager);
  });

  it("passes undefined memoryManager to resolvePluginTools when not provided", () => {
    createOpenClawTools({});

    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0]?.memoryManager).toBeUndefined();
  });

  it("still returns an array of tools when memoryManager is provided", () => {
    const manager = makeMemoryManager();
    const tools = createOpenClawTools({ memoryManager: manager });
    expect(Array.isArray(tools)).toBe(true);
  });
});
