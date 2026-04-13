import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from './agent-service.js';

vi.mock('@/persistence/firebase.js', () => ({
  firebaseService: {
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    getCollection: vi.fn(),
  },
}));

vi.mock('../services/ChannelService.js', () => ({
  default: { getChannelsForAgent: vi.fn(), deleteChannel: vi.fn() },
}));

vi.mock('../tenancy/resolver-instance.js', () => ({
  userContextResolver: { fromUserId: vi.fn() },
}));

vi.mock('../tenancy/tenant-context.js', () => ({
  createAuthGuard: vi.fn(),
}));

vi.mock('../billing/auth-guard.js', () => ({
  assertCan: vi.fn(),
}));

vi.mock('../billing/usage-tracker.js', () => ({
  trackUsage: vi.fn(),
}));

vi.mock('@/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { userContextResolver } from '../tenancy/resolver-instance.js';
import { createAuthGuard } from '../tenancy/tenant-context.js';
import { assertCan } from '../billing/auth-guard.js';
import { firebaseService } from '@/persistence/firebase.js';

describe('agents-management/AgentService', () => {
  let service: AgentService;
  const userId = 'user-abc';

  beforeEach(() => {
    vi.clearAllMocks();
    service = AgentService.getInstance();
  });

  describe('createAgent', () => {
    it('denies creation when plan limit is reached', async () => {
      vi.mocked(userContextResolver.fromUserId).mockResolvedValue({ userId } as any);
      vi.mocked(createAuthGuard).mockReturnValue({ canCreateAgent: () => false } as any);
      vi.mocked(assertCan).mockImplementation(() => {
        throw Object.assign(new Error('Agent limit reached for starter plan.'), { statusCode: 402 });
      });

      const result = await service.createAgent(userId, { name: 'TestAgent' });

      expect(result.success).toBe(false);
      expect((result as any).error.message).toMatch(/limit/i);
    });

    it('creates agent when within plan limit', async () => {
      vi.mocked(userContextResolver.fromUserId).mockResolvedValue({ userId } as any);
      vi.mocked(createAuthGuard).mockReturnValue({ canCreateAgent: () => true } as any);
      vi.mocked(assertCan).mockReturnValue(undefined);
      vi.mocked(firebaseService.setDoc).mockResolvedValue(undefined);

      const result = await service.createAgent(userId, { name: 'TestAgent' });

      expect(result.success).toBe(true);
      expect(userContextResolver.fromUserId).toHaveBeenCalledWith(userId);
    });
  });
});
