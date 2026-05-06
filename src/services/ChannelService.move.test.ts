import { describe, it, expect, beforeEach, vi } from "vitest";
import { firebaseService } from "@/persistence/firebase.js";
import { ChannelService } from "./ChannelService.js";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockNativeManager } = vi.hoisted(() => ({
  mockNativeManager: {
    startChannel: vi.fn().mockResolvedValue(undefined),
    stopChannel: vi.fn().mockResolvedValue(undefined),
    getRuntimeSnapshot: vi.fn().mockReturnValue({ channels: {}, channelAccounts: {} }),
  },
}));

vi.mock("@/persistence/firebase.js", () => ({
  firebaseService: {
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    deleteCollection: vi.fn(),
  },
}));

vi.mock("../gateway/server-channels.js", () => ({
  createChannelManager: vi.fn().mockReturnValue(mockNativeManager),
}));

vi.mock("../channels/plugins/index.js", () => ({
  listChannelPlugins: vi.fn().mockReturnValue([]),
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  runtimeForLogger: vi.fn().mockReturnValue({}),
}));

vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({}),
}));

vi.mock("./SystemAuthorityService.js", () => ({
  systemAuthorityService: {
    checkAuthority: vi.fn().mockResolvedValue({ allowed: true }),
    recordUsage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./socketService.js", () => ({
  socketService: { emitChannelStatus: vi.fn() },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChannelService Move", () => {
  let service: ChannelService;
  const tenantId = "tenant-123";
  const channelId = "chan-1";
  const oldAgentId = "agent-old";
  const newAgentId = "agent-new";
  const mockChannel = {
    id: channelId,
    type: "whatsapp",
    status: "connected",
    assignedAgentId: oldAgentId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore — reset singleton
    ChannelService.instance = undefined;
    service = ChannelService.getInstance();
    vi.mocked(firebaseService.getDoc).mockResolvedValue(mockChannel);
    vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);
    vi.mocked(firebaseService.deleteDoc).mockResolvedValue(undefined);
  });

  describe("moveChannel", () => {
    it("should copy channel doc to new agent path and delete from old path", async () => {
      await service.moveChannel(tenantId, channelId, oldAgentId, newAgentId);

      expect(firebaseService.setDoc).toHaveBeenCalledWith(
        `agents/${newAgentId}/channels`,
        channelId,
        expect.objectContaining({ assignedAgentId: newAgentId }),
        tenantId,
      );
      expect(firebaseService.deleteDoc).toHaveBeenCalledWith(
        `agents/${oldAgentId}/channels`,
        channelId,
        tenantId,
      );
    });

    it("should return error if channel not found", async () => {
      vi.mocked(firebaseService.getDoc).mockResolvedValue(null);

      const result = await service.moveChannel(tenantId, channelId, oldAgentId, newAgentId);

      expect(result.success).toBe(false);
      expect(firebaseService.setDoc).not.toHaveBeenCalled();
      expect(firebaseService.deleteDoc).not.toHaveBeenCalled();
    });
  });
});
