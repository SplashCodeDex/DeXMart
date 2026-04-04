import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelService } from './ChannelService.js';
import { firebaseService } from '@/services/FirebaseService.js';
import { channelManager } from './channels/ChannelManager.js';

// Mock dependencies
vi.mock('@/services/FirebaseService.js', () => ({
  firebaseService: {
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    deleteCollection: vi.fn()
  }
}));

vi.mock('./channels/ChannelManager.js', () => ({
  channelManager: {
    shutdownAdapter: vi.fn()
  }
}));

describe('ChannelService Cleanup', () => {
  let service: ChannelService;
  const tenantId = 'tenant-123';
  const channelId = 'chan-1';
  const agentId = 'agent-456';

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - reset instance
    ChannelService.instance = undefined;
    service = ChannelService.getInstance();
  });

  describe('deleteChannel with Auth Cleanup', () => {
    it('should delete the channel document AND its auth collection', async () => {
      await service.deleteChannel(tenantId, channelId, agentId);

      // 1. Shutdown live adapter
      expect(channelManager.shutdownAdapter).toHaveBeenCalledWith(channelId);

      // 2. Delete main document
      expect(firebaseService.deleteDoc).toHaveBeenCalledWith(`agents/${agentId}/channels`, channelId, tenantId);

      // 3. Delete auth collection
      const expectedAuthPath = `agents/${agentId}/channels/${channelId}/auth`;
      expect(firebaseService.deleteCollection).toHaveBeenCalledWith(expectedAuthPath, tenantId);
    });

    it('should NOT delete auth collection if archiving', async () => {
      // Mock updateChannel success
      vi.spyOn(service, 'updateChannel').mockResolvedValue({ success: true, data: {} as any });

      await service.deleteChannel(tenantId, channelId, agentId, { archive: true });

      expect(firebaseService.deleteDoc).not.toHaveBeenCalled();
      expect(firebaseService.deleteCollection).not.toHaveBeenCalled();
    });
  });
});
