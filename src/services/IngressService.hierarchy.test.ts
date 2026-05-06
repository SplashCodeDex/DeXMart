import { describe, it, expect, beforeEach, vi } from "vitest";
import { agentService } from "./AgentService.js";
import { IngressService } from "./IngressService.js";
import { tenantConfigService } from "./tenantConfigService.js";
import { webhookService } from "./webhookService.js";

// Mock dependencies
vi.mock("./AgentService.js", () => ({
  agentService: {
    getAgent: vi.fn(),
  },
}));

vi.mock("./webhookService.js", () => ({
  webhookService: {
    dispatch: vi.fn(),
  },
}));

vi.mock("./tenantConfigService.js", () => ({
  tenantConfigService: {
    isFeatureEnabled: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../utils/createChannelContext.js", () => ({
  createChannelContext: vi.fn().mockResolvedValue({
    sender: { jid: "user-123" },
    message: { conversation: "hello" },
  }),
}));

vi.mock("./deduplicationService.js", () => ({
  deduplicationService: {
    shouldProcess: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("../utils/messageNormalizer.js", () => ({
  MessageNormalizer: {
    getId: vi.fn().mockReturnValue("msg-1"),
    getTimestamp: vi.fn().mockReturnValue(Date.now()),
  },
}));

vi.mock("./automationService.js", () => ({
  automationService: {
    listAutomations: vi.fn().mockResolvedValue({ success: true, data: [] }),
    executeAutomation: vi.fn(),
  },
}));

vi.mock("./flowService.js", () => ({
  flowService: {
    listActiveFlows: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

vi.mock("./flowEngine.js", () => ({
  flowEngine: {
    executeFlow: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock("./analytics.js", () => ({
  default: {
    trackMessage: vi.fn(),
  },
}));

describe("IngressService Hierarchy", () => {
  let service: IngressService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = IngressService.getInstance();
  });

  it("should resolve Agent from fullPath and bypass ChannelBindingService", async () => {
    const tenantId = "tenant-1";
    const agentId = "agent-1";
    const channelId = "chan-1";
    const fullPath = `tenants/${tenantId}/agents/${agentId}/channels/${channelId}`;

    vi.mocked(agentService.getAgent).mockResolvedValue({
      success: true,
      data: { id: agentId, name: "Path Agent" } as any,
    });

    // handleMessage dispatches via webhook (not unifiedAI.processMessage directly)
    // @ts-ignore - testing new parameter
    await service.handleMessage(tenantId, channelId, {} as any, {} as any, fullPath);

    expect(agentService.getAgent).toHaveBeenCalledWith(tenantId, agentId);
    expect(webhookService.dispatch).toHaveBeenCalledWith(
      tenantId,
      "message.received",
      expect.objectContaining({ channelId }),
    );
  });
});
