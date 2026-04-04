import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from './AgentService.js';
import { firebaseService } from './FirebaseService.js';
import channelService from './ChannelService.js';
import { systemAuthorityService } from './SystemAuthorityService.js';

// Mock dependencies
vi.mock('./FirebaseService.js', () => ({
  firebaseService: {
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    getCollection: vi.fn(),
    deleteDoc: vi.fn()
  },
  FirebaseService: { getInstance: () => ({}) }
}));

vi.mock('./ChannelService.js', () => ({
  default: {
    getChannelsForAgent: vi.fn(),
    deleteChannel: vi.fn()
  }
}));

vi.mock('./SystemAuthorityService.js', () => ({
  systemAuthorityService: {
    checkAuthority: vi.fn(),
    recordUsage: vi.fn()
  }
}));

vi.mock('@/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('AgentService', () => {
  let service: AgentService;
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - reset singleton
    AgentService.instance = undefined;
    service = AgentService.getInstance();
  });

  describe('ensureSystemAgent', () => {
    it('should create system_default agent if it does not exist', async () => {
      vi.mocked(firebaseService.getDoc).mockResolvedValue(null);
      vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);

      const result = await service.ensureSystemAgent(tenantId);

      expect(result.success).toBe(true);
      expect(firebaseService.getDoc).toHaveBeenCalledWith('agents', 'system_default', tenantId);
      expect(firebaseService.setDoc).toHaveBeenCalledWith('agents', 'system_default', expect.objectContaining({
        id: 'system_default',
        name: 'System Default Agent'
      }), tenantId);
    });

    it('should return existing system_default if it exists', async () => {
      vi.mocked(firebaseService.getDoc).mockResolvedValue({ id: 'system_default', name: 'Existing' });

      const result = await service.ensureSystemAgent(tenantId);

      expect(result.success).toBe(true);
      expect(firebaseService.setDoc).not.toHaveBeenCalled();
    });
  });

  describe('createAgent', () => {
    it('should create an agent when authority allows', async () => {
      vi.mocked(systemAuthorityService.checkAuthority).mockResolvedValue({ allowed: true });
      vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);
      vi.mocked(systemAuthorityService.recordUsage).mockResolvedValue(undefined);

      const result = await service.createAgent(tenantId, { name: 'My Bot', personality: 'Helpful' });

      expect(result.success).toBe(true);
      expect(systemAuthorityService.checkAuthority).toHaveBeenCalledWith(tenantId, 'create_agent');
      expect(firebaseService.setDoc).toHaveBeenCalled();
      expect(systemAuthorityService.recordUsage).toHaveBeenCalledWith(tenantId, 'agents', 1);
    });

    it('should block agent creation when authority denies', async () => {
      vi.mocked(systemAuthorityService.checkAuthority).mockResolvedValue({
        allowed: false,
        error: 'Agent limit reached for your plan'
      });

      const result = await service.createAgent(tenantId, { name: 'Blocked Bot' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Agent limit reached for your plan');
      }
      expect(firebaseService.setDoc).not.toHaveBeenCalled();
      expect(systemAuthorityService.recordUsage).not.toHaveBeenCalled();
    });

    it('should use fallback error message when authority denies without a message', async () => {
      vi.mocked(systemAuthorityService.checkAuthority).mockResolvedValue({ allowed: false });

      const result = await service.createAgent(tenantId, { name: 'Blocked Bot' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Agent creation limit reached');
      }
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent and shutdown all child channels', async () => {
      const agentId = 'agent-to-kill';
      const mockChannels = [{ id: 'chan-1' }, { id: 'chan-2' }];
      
      vi.mocked(channelService.getChannelsForAgent).mockResolvedValue({ success: true, data: mockChannels as any });
      vi.mocked(channelService.deleteChannel).mockResolvedValue({ success: true, data: undefined });

      const result = await service.deleteAgent(tenantId, agentId);

      expect(result.success).toBe(true);
      expect(channelService.getChannelsForAgent).toHaveBeenCalledWith(tenantId, agentId);
      expect(channelService.deleteChannel).toHaveBeenCalledTimes(2);
      expect(firebaseService.deleteDoc).toHaveBeenCalledWith('agents', agentId, tenantId);
    });

    it('should fail if trying to delete system_default', async () => {
      const result = await service.deleteAgent(tenantId, 'system_default');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Cannot delete the system default agent.');
      }
    });
  });
});
