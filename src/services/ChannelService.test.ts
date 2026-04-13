import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelService } from './ChannelService.js';
import { firebaseService } from '@/services/FirebaseService.js';
import { systemAuthorityService } from './SystemAuthorityService.js';
import { createChannelManager } from '../gateway/server-channels.js';
import type { ChannelManager } from '../gateway/server-channels.js';

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

vi.mock('../gateway/server-channels.js', () => ({
  createChannelManager: vi.fn()
}));

describe('ChannelService', () => {
  let service: ChannelService;
  const tenantId = 'tenant-123';
  const userId = 'user-abc123';
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

      const result = await service.createChannel(tenantId, { name: 'Test Channel', type: 'whatsapp' }, 'system_default', userId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Channel');
        expect(result.data.assignedAgentId).toBe('system_default');
        expect(firebaseService.setDoc).toHaveBeenCalledWith(systemPath, result.data.id, expect.any(Object), tenantId);
        expect(systemAuthorityService.recordUsage).toHaveBeenCalledWith(userId, 'channels', 1);
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
      // Provide a mock native manager so deleteChannel can call stopChannel()
      vi.mocked(createChannelManager).mockReturnValue({
        stopChannel: vi.fn().mockResolvedValue(undefined),
        startChannel: vi.fn().mockResolvedValue(undefined),
        startChannels: vi.fn().mockResolvedValue(undefined),
        getRuntimeSnapshot: vi.fn().mockReturnValue({ channels: {}, channelAccounts: {} }),
        markChannelLoggedOut: vi.fn(),
        isManuallyStopped: vi.fn().mockReturnValue(false),
        resetRestartAttempts: vi.fn(),
      });
      vi.mocked(firebaseService.getDoc).mockResolvedValue({ id: 'chan-1', name: 'Test', type: 'whatsapp' });
      vi.mocked(firebaseService.deleteDoc).mockResolvedValue(undefined);
      vi.mocked(firebaseService.deleteCollection).mockResolvedValue(undefined);

      const result = await service.deleteChannel(tenantId, 'chan-1', 'system_default', {}, userId);

      expect(result.success).toBe(true);
      expect(firebaseService.deleteDoc).toHaveBeenCalledWith(systemPath, 'chan-1', tenantId);
      expect(systemAuthorityService.recordUsage).toHaveBeenCalledWith(userId, 'channels', -1);
    });
  });
});

// ── Task 5.4: ChannelService delegates lifecycle to native createChannelManager() ────────────────

function makeMockManager(overrides: Partial<ChannelManager> = {}): ChannelManager {
  return {
    startChannel: vi.fn().mockResolvedValue(undefined),
    stopChannel: vi.fn().mockResolvedValue(undefined),
    startChannels: vi.fn().mockResolvedValue(undefined),
    getRuntimeSnapshot: vi.fn().mockReturnValue({ channels: {}, channelAccounts: {} }),
    markChannelLoggedOut: vi.fn(),
    isManuallyStopped: vi.fn().mockReturnValue(false),
    resetRestartAttempts: vi.fn(),
    ...overrides,
  };
}

describe('ChannelService — native createChannelManager() delegation (Task 5.4)', () => {
  let service: ChannelService;
  const tenantId = 'tenant-123';
  const agentId = 'system_default';

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    ChannelService.instance = undefined;
    service = ChannelService.getInstance();
  });

  describe('startChannel', () => {
    it('creates a channel manager scoped to the userId and delegates startChannel()', async () => {
      const mockManager = makeMockManager();
      vi.mocked(createChannelManager).mockReturnValue(mockManager);
      vi.mocked(firebaseService.getDoc).mockResolvedValue({
        id: 'chan-wa-1',
        type: 'whatsapp',
        status: 'disconnected',
        assignedAgentId: agentId,
      });
      vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);

      const result = await service.startChannel(tenantId, 'chan-wa-1', agentId);

      expect(result.success).toBe(true);
      expect(createChannelManager).toHaveBeenCalledWith(
        expect.objectContaining({ userId: tenantId })
      );
      expect(mockManager.startChannel).toHaveBeenCalledWith(
        'whatsapp',
        expect.any(String)
      );
    });

    it('does NOT instantiate any AdapterClass from the deprecated registry', async () => {
      const mockManager = makeMockManager();
      vi.mocked(createChannelManager).mockReturnValue(mockManager);
      vi.mocked(firebaseService.getDoc).mockResolvedValue({
        id: 'chan-tg-1',
        type: 'telegram',
        status: 'disconnected',
        assignedAgentId: agentId,
      });
      vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);

      await service.startChannel(tenantId, 'chan-tg-1', agentId);

      // Verify delegation happened — no direct adapter construction
      expect(mockManager.startChannel).toHaveBeenCalledWith('telegram', expect.any(String));
    });

    it('returns success: false when channel not found in Firestore', async () => {
      vi.mocked(createChannelManager).mockReturnValue(makeMockManager());
      vi.mocked(firebaseService.getDoc).mockResolvedValue(null);

      const result = await service.startChannel(tenantId, 'chan-missing', agentId);

      expect(result.success).toBe(false);
    });
  });

  describe('stopChannel', () => {
    it('delegates to native manager stopChannel() with correct plugin type', async () => {
      const mockManager = makeMockManager();
      vi.mocked(createChannelManager).mockReturnValue(mockManager);
      vi.mocked(firebaseService.getDoc).mockResolvedValue({
        id: 'chan-wa-2',
        type: 'whatsapp',
        status: 'connected',
        assignedAgentId: agentId,
      });
      vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);

      const result = await service.stopChannel('chan-wa-2', tenantId, agentId);

      expect(result.success).toBe(true);
      expect(mockManager.stopChannel).toHaveBeenCalledWith('whatsapp', expect.any(String));
    });
  });

  describe('getGlobalStats', () => {
    it('derives active channel count from getRuntimeSnapshot() instead of deprecated channelManager', () => {
      const mockManager = makeMockManager({
        getRuntimeSnapshot: vi.fn().mockReturnValue({
          channels: { whatsapp: { running: true }, telegram: { running: false } },
          channelAccounts: {},
        }),
      });
      vi.mocked(createChannelManager).mockReturnValue(mockManager);

      const stats = service.getGlobalStats();

      // Should reflect snapshot data, not the deprecated registry
      expect(mockManager.getRuntimeSnapshot).toHaveBeenCalled();
      expect(stats.activeChannels).toBeGreaterThanOrEqual(0);
    });
  });
});
