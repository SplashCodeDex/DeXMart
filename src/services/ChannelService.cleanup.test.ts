import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelService } from './ChannelService.js';
import { firebaseService } from '@/persistence/firebase.js';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockNativeManager } = vi.hoisted(() => ({
  mockNativeManager: {
    startChannel: vi.fn().mockResolvedValue(undefined),
    stopChannel: vi.fn().mockResolvedValue(undefined),
    getRuntimeSnapshot: vi.fn().mockReturnValue({ channels: {}, channelAccounts: {} }),
  },
}));

vi.mock('@/persistence/firebase.js', () => ({
  firebaseService: {
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    deleteCollection: vi.fn(),
  },
}));

vi.mock('../gateway/server-channels.js', () => ({
  createChannelManager: vi.fn().mockReturnValue(mockNativeManager),
}));

vi.mock('../channels/plugins/index.js', () => ({
  listChannelPlugins: vi.fn().mockReturnValue([]),
}));

vi.mock('../logging/subsystem.js', () => ({
  createSubsystemLogger: vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  runtimeForLogger: vi.fn().mockReturnValue({}),
}));

vi.mock('../config/config.js', () => ({
  loadConfig: vi.fn().mockReturnValue({}),
}));

vi.mock('./SystemAuthorityService.js', () => ({
  systemAuthorityService: {
    checkAuthority: vi.fn().mockResolvedValue({ allowed: true }),
    recordUsage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./socketService.js', () => ({
  socketService: { emitChannelStatus: vi.fn() },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChannelService Cleanup', () => {
  let service: ChannelService;
  const tenantId = 'tenant-123';
  const channelId = 'chan-1';
  const agentId = 'agent-456';
  const mockChannel = { id: channelId, type: 'whatsapp', status: 'connected', assignedAgentId: agentId };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore — reset singleton
    ChannelService.instance = undefined;
    service = ChannelService.getInstance();
    vi.mocked(firebaseService.getDoc).mockResolvedValue(mockChannel);
    vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);
    vi.mocked(firebaseService.deleteDoc).mockResolvedValue(undefined);
    vi.mocked(firebaseService.deleteCollection).mockResolvedValue(undefined);
  });

  describe('deleteChannel with Auth Cleanup', () => {
    it('should stop native channel, delete channel document AND auth collection', async () => {
      await service.deleteChannel(tenantId, channelId, agentId);

      // 1. Native manager stopChannel called (non-fatal stop before delete)
      expect(mockNativeManager.stopChannel).toHaveBeenCalledWith('whatsapp', channelId);

      // 2. Delete main document
      expect(firebaseService.deleteDoc).toHaveBeenCalledWith(
        `agents/${agentId}/channels`,
        channelId,
        tenantId,
      );

      // 3. Delete auth sub-collection (Baileys credentials cleanup)
      const expectedAuthPath = `agents/${agentId}/channels/${channelId}/auth`;
      expect(firebaseService.deleteCollection).toHaveBeenCalledWith(expectedAuthPath, tenantId);
    });

    it('should NOT delete auth collection if archiving', async () => {
      vi.mocked(firebaseService.getDoc)
        .mockResolvedValueOnce(mockChannel)           // ownership check
        .mockResolvedValueOnce({ ...mockChannel, status: 'archived' }); // post-setDoc getChannel

      await service.deleteChannel(tenantId, channelId, agentId, { archive: true });

      expect(firebaseService.deleteDoc).not.toHaveBeenCalled();
      expect(firebaseService.deleteCollection).not.toHaveBeenCalled();
    });
  });
});
