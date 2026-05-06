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

describe("ChannelService Lifecycle Actions", () => {
  let service: ChannelService;
  const tenantId = "tenant-123";
  const channelId = "chan-1";
  const agentId = "agent-456";
  const mockChannel = {
    id: channelId,
    type: "whatsapp",
    status: "connected",
    assignedAgentId: agentId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore — reset singleton
    ChannelService.instance = undefined;
    service = ChannelService.getInstance();
    vi.mocked(firebaseService.getDoc).mockResolvedValue(mockChannel);
    vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);
  });

  describe("stopChannel", () => {
    it("should delegate to native manager and return success", async () => {
      const result = await service.stopChannel(channelId, tenantId, agentId);

      expect(result.success).toBe(true);
      expect(mockNativeManager.stopChannel).toHaveBeenCalledWith("whatsapp", channelId);
    });

    it("should return error if channel not found", async () => {
      vi.mocked(firebaseService.getDoc).mockResolvedValue(null);

      const result = await service.stopChannel(channelId, tenantId, agentId);

      expect(result.success).toBe(false);
      expect(mockNativeManager.stopChannel).not.toHaveBeenCalled();
    });
  });

  describe("deleteChannel", () => {
    it("should stop native channel and delete from Firestore when archive is false", async () => {
      vi.mocked(firebaseService.deleteDoc).mockResolvedValue(undefined);
      vi.mocked(firebaseService.deleteCollection).mockResolvedValue(undefined);

      const result = await service.deleteChannel(tenantId, channelId, agentId, { archive: false });

      expect(result.success).toBe(true);
      expect(mockNativeManager.stopChannel).toHaveBeenCalledWith("whatsapp", channelId);
      expect(firebaseService.deleteDoc).toHaveBeenCalledWith(
        `agents/${agentId}/channels`,
        channelId,
        tenantId,
      );
    });

    it("should stop native channel and update status to archived when archive is true", async () => {
      vi.mocked(firebaseService.getDoc)
        .mockResolvedValueOnce(mockChannel) // ownership check
        .mockResolvedValueOnce({ ...mockChannel, status: "archived" }); // post-setDoc getChannel

      const result = await service.deleteChannel(tenantId, channelId, agentId, { archive: true });

      expect(result.success).toBe(true);
      expect(mockNativeManager.stopChannel).toHaveBeenCalledWith("whatsapp", channelId);
      expect(firebaseService.setDoc).toHaveBeenCalledWith(
        `agents/${agentId}/channels`,
        channelId,
        expect.objectContaining({ status: "archived" }),
        tenantId,
        true,
      );
      expect(firebaseService.deleteDoc).not.toHaveBeenCalled();
    });
  });
});
