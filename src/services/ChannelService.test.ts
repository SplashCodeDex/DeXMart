import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelService } from './ChannelService.js';
import { firebaseService } from '@/services/FirebaseService.js';
import { systemAuthorityService } from './SystemAuthorityService.js';

// Mock dependencies
vi.mock('@/services/FirebaseService.js', () => ({
  firebaseService: {
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    getCollection: vi.fn(),
    deleteDoc: vi.fn(),
    deleteCollection: vi.fn()
  }
}));

vi.mock('./SystemAuthorityService.js', () => ({
  systemAuthorityService: {
    checkAuthority: vi.fn(),
    recordUsage: vi.fn(),
    getCapabilities: vi.fn()
  }
}));

describe('ChannelService', () => {
  let service: ChannelService;
  const tenantId = 'tenant-123';
  const systemPath = 'agents/system_default/channels';

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - access private instance for test reset
    ChannelService.instance = undefined;
    service = ChannelService.getInstance();
  });

  describe('createChannel', () => {
    it('should create a new channel under system_default by default', async () => {
      vi.mocked(systemAuthorityService.checkAuthority).mockResolvedValue({ allowed: true });
      vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);

      const result = await service.createChannel(tenantId, { name: 'Test Channel', type: 'whatsapp' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Channel');
        expect(result.data.assignedAgentId).toBe('system_default');
        expect(firebaseService.setDoc).toHaveBeenCalledWith(systemPath, result.data.id, expect.any(Object), tenantId);
        expect(systemAuthorityService.recordUsage).toHaveBeenCalledWith(tenantId, 'channels', 1);
      }
    });

    it('should create a new channel under a specific agent', async () => {
      vi.mocked(systemAuthorityService.checkAuthority).mockResolvedValue({ allowed: true });
      const agentId = 'custom-agent';
      const result = await service.createChannel(tenantId, { name: 'Agent Bot' }, agentId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignedAgentId).toBe(agentId);
        expect(firebaseService.setDoc).toHaveBeenCalledWith(`agents/${agentId}/channels`, expect.any(String), expect.any(Object), tenantId);
      }
    });
  });

  describe('getChannel', () => {
    it('should return channel data from system_default path by default', async () => {
      const mockChannel = { id: 'chan-1', name: 'Existing' };
      vi.mocked(firebaseService.getDoc).mockResolvedValue(mockChannel);

      const result = await service.getChannel(tenantId, 'chan-1');

      expect(result.success).toBe(true);
      expect(firebaseService.getDoc).toHaveBeenCalledWith(systemPath, 'chan-1', tenantId);
    });
  });

  describe('deleteChannel', () => {
    it('should delete channel from nested path', async () => {
      vi.mocked(firebaseService.deleteDoc).mockResolvedValue(undefined);
      vi.mocked(firebaseService.deleteCollection).mockResolvedValue(undefined);

      const result = await service.deleteChannel(tenantId, 'chan-1');

      expect(result.success).toBe(true);
      expect(firebaseService.deleteDoc).toHaveBeenCalledWith(systemPath, 'chan-1', tenantId);
      expect(systemAuthorityService.recordUsage).toHaveBeenCalledWith(tenantId, 'channels', -1);
    });
  });
});
