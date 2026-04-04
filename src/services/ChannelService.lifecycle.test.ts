import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelService } from './ChannelService.js';
import { firebaseService } from '@/services/FirebaseService.js';
import { channelManager } from './channels/ChannelManager.js';

// Mock dependencies
vi.mock('@/services/FirebaseService.js', () => ({
  firebaseService: {
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn()
  }
}));

vi.mock('./channels/ChannelManager.js', () => ({
  channelManager: {
    shutdownAdapter: vi.fn(),
    getAdapter: vi.fn()
  }
}));

describe('ChannelService Lifecycle Actions', () => {
  let service: ChannelService;
  const tenantId = 'tenant-123';
  const channelId = 'chan-1';
  const agentId = 'agent-456';
  const expectedPath = `agents/${agentId}/channels`;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - reset instance
    ChannelService.instance = undefined;
    service = ChannelService.getInstance();
  });

  describe('stopChannel', () => {
    it('should shutdown the adapter and update status to disconnected', async () => {
      vi.mocked(channelManager.shutdownAdapter).mockResolvedValue(undefined);
      vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);
      vi.mocked(firebaseService.getDoc).mockResolvedValue({ id: channelId, status: 'disconnected' });

      const result = await service.stopChannel(channelId, tenantId, agentId);

      expect(result.success).toBe(true);
      expect(channelManager.shutdownAdapter).toHaveBeenCalledWith(channelId);
      expect(firebaseService.setDoc).toHaveBeenCalledWith(
        expectedPath,
        channelId,
        expect.objectContaining({ status: 'disconnected' }),
        tenantId,
        true
      );
    });

    it('should return error if updateStatus fails', async () => {
      vi.mocked(channelManager.shutdownAdapter).mockResolvedValue(undefined);
      vi.mocked(firebaseService.setDoc).mockRejectedValue(new Error('Firestore error'));

      const result = await service.stopChannel(channelId, tenantId, agentId);

      expect(result.success).toBe(false);
    });
  });

  describe('deleteChannel', () => {
    it('should shutdown the adapter and delete from Firestore when archive is false', async () => {
      vi.mocked(channelManager.shutdownAdapter).mockResolvedValue(undefined);
      vi.mocked(firebaseService.deleteDoc).mockResolvedValue(undefined);

      const result = await service.deleteChannel(tenantId, channelId, agentId, { archive: false });

      expect(result.success).toBe(true);
      expect(channelManager.shutdownAdapter).toHaveBeenCalledWith(channelId);
      expect(firebaseService.deleteDoc).toHaveBeenCalledWith(expectedPath, channelId, tenantId);
    });

    it('should shutdown the adapter and update status to archived when archive is true', async () => {
      vi.mocked(channelManager.shutdownAdapter).mockResolvedValue(undefined);
      vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);
      vi.mocked(firebaseService.getDoc).mockResolvedValue({ id: channelId, status: 'archived' });

      const result = await service.deleteChannel(tenantId, channelId, agentId, { archive: true });

      expect(result.success).toBe(true);
      expect(channelManager.shutdownAdapter).toHaveBeenCalledWith(channelId);
      expect(firebaseService.setDoc).toHaveBeenCalledWith(
        expectedPath,
        channelId,
        expect.objectContaining({ status: 'archived' }),
        tenantId,
        true
      );
      expect(firebaseService.deleteDoc).not.toHaveBeenCalled();
    });
  });
});
