import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelService } from './ChannelService.js';
import { firebaseService } from '@/services/FirebaseService.js';
import { channelManager } from './channels/ChannelManager.js';
import { IngressService } from './IngressService.js';

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
    getAdapter: vi.fn()
  }
}));

vi.mock('./IngressService.js', () => ({
  ingressService: {
    handleMessage: vi.fn()
  }
}));

describe('ChannelService Path-Aware Routing', () => {
  let service: ChannelService;
  const tenantId = 'tenant-123';
  const channelId = 'chan-1';
  const oldAgentId = 'agent-old';
  const newAgentId = 'agent-new';

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - reset instance
    ChannelService.instance = undefined;
    service = ChannelService.getInstance();
  });

  describe('moveChannel', () => {
    it('should update the adapter fullPath when a channel is moved', async () => {
      const mockChannel = {
        id: channelId,
        type: 'whatsapp',
        status: 'connected',
        assignedAgentId: oldAgentId
      };

      const mockAdapter = {
        channelId,
        tenantId,
        fullPath: `tenants/${tenantId}/agents/${oldAgentId}/channels/${channelId}`,
        updatePath: function(newPath: string) {
            this.fullPath = newPath;
        }
      };

      vi.mocked(firebaseService.getDoc).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.getAdapter).mockReturnValue(mockAdapter as any);

      await service.moveChannel(tenantId, channelId, oldAgentId, newAgentId);

      // Verify Firestore changes
      expect(firebaseService.setDoc).toHaveBeenCalledWith(
        `agents/${newAgentId}/channels`,
        channelId,
        expect.objectContaining({ assignedAgentId: newAgentId }),
        tenantId
      );
      expect(firebaseService.deleteDoc).toHaveBeenCalledWith(`agents/${oldAgentId}/channels`, channelId, tenantId);

      // Verify Adapter path update (This is what we want to fix)
      expect(mockAdapter.fullPath).toBe(`tenants/${tenantId}/agents/${newAgentId}/channels/${channelId}`);
    });
  });
});
