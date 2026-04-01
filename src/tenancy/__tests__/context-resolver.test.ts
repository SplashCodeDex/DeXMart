import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserContextResolver } from '../tenant-context.js';
import { db, admin } from '../../dexmart-lib/firebase.js';
import Redis from 'ioredis';

// Mock Dependencies
vi.mock('../../dexmart-lib/firebase.js', () => ({
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
  },
  admin: {
    auth: vi.fn(() => ({
      verifyIdToken: vi.fn(),
    })),
  },
}));

vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  }));
  return { default: MockRedis };
});

// Implementation will be in ../context-resolver.js
import { UserContextResolverImpl } from '../context-resolver.js';

describe('UserContextResolverImpl', () => {
  let resolver: UserContextResolver;
  let redis: any;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = new Redis();
    resolver = new UserContextResolverImpl(db as any, admin as any, redis);
  });

  describe('fromUserId', () => {
    it('should resolve from Redis cache if available', async () => {
      const mockContext = { userId: 'user-123', plan: 'pro' };
      redis.get.mockResolvedValue(JSON.stringify(mockContext));

      const result = await resolver.fromUserId('user-123');

      expect(result.userId).toBe('user-123');
      expect(redis.get).toHaveBeenCalledWith('user:context:user-123');
      expect(db.collection).not.toHaveBeenCalled(); // No Firestore call on cache hit
    });

    it('should resolve from Firestore if Redis cache is missing', async () => {
      const mockUserData = { id: 'user-123', email: 'test@example.com', plan: 'pro' };
      const mockUsageData = { messagesThisPeriod: 10 };
      
      redis.get.mockResolvedValue(null);
      
      // Mock Firestore lookups for user and usage
      const docMock = {
        exists: true,
        data: vi.fn()
          .mockReturnValueOnce(mockUserData)  // /users/user-123
          .mockReturnValueOnce(mockUsageData) // /users/user-123/usage/current
      };
      
      (db.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(docMock)
        })
      });

      const result = await resolver.fromUserId('user-123');

      expect(result.userId).toBe('user-123');
      expect(result.plan).toBe('pro');
      expect(redis.setex).toHaveBeenCalledWith(
        'user:context:user-123',
        300, // 5 min TTL
        expect.any(String)
      );
    });

    it('should throw error if user not found in Firestore', async () => {
      redis.get.mockResolvedValue(null);
      (db.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false })
        })
      });

      await expect(resolver.fromUserId('non-existent')).rejects.toThrow('User not found');
    });
  });

  describe('fromToken', () => {
    it('should verify token and resolve from userId', async () => {
      const mockDecodedToken = { uid: 'user-jwt-123' };
      (admin.auth as any)().verifyIdToken.mockResolvedValue(mockDecodedToken);
      
      const spy = vi.spyOn(resolver, 'fromUserId').mockResolvedValue({ userId: 'user-jwt-123' } as any);

      const result = await resolver.fromToken('valid-jwt');

      expect(result.userId).toBe('user-jwt-123');
      expect(spy).toHaveBeenCalledWith('user-jwt-123');
    });
  });

  describe('fromChannelId', () => {
    it('should resolve via channel mapping', async () => {
      const channelId = 'whatsapp-123';
      const userId = 'user-mapped-123';
      
      redis.get.mockResolvedValueOnce(userId); // cache hit for channel mapping
      const spy = vi.spyOn(resolver, 'fromUserId').mockResolvedValue({ userId } as any);

      const result = await resolver.fromChannelId(channelId);

      expect(result.userId).toBe(userId);
      expect(spy).toHaveBeenCalledWith(userId);
    });
  });
});
