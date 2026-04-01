import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cache } from './cache.js';
import redisClient from './redis.js';

vi.mock('./redis.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('Cache Service (Co-located Test)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createKey', () => {
    it('should generate a consistent MD5 hash for the same input', () => {
      const data = { foo: 'bar' };
      const key1 = cache.createKey(data);
      const key2 = cache.createKey(data);
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(32); // MD5 hex length
    });
  });

  describe('get', () => {
    it('should return a success Result with data when key exists', async () => {
      const mockData = { id: 1, name: 'Test' };
      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(mockData));

      const result = await cache.get('test-key');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockData);
      }
      expect(redisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return success Result with null when key does not exist', async () => {
      vi.mocked(redisClient.get).mockResolvedValue(null);

      const result = await cache.get('missing-key');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('should return a failure Result when redis fails', async () => {
      const error = new Error('Redis down');
      vi.mocked(redisClient.get).mockRejectedValue(error);

      const result = await cache.get('test-key');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('set', () => {
    it('should return a success Result when set is successful', async () => {
      vi.mocked(redisClient.set).mockResolvedValue('OK');

      const result = await cache.set('key', { val: 1 }, 100);

      expect(result.success).toBe(true);
      expect(redisClient.set).toHaveBeenCalledWith('key', JSON.stringify({ val: 1 }), 'EX', 100);
    });

    it('should return a failure Result when set fails', async () => {
      vi.mocked(redisClient.set).mockRejectedValue(new Error('Set failed'));

      const result = await cache.set('key', 'value');

      expect(result.success).toBe(false);
    });
  });

  describe('del', () => {
    it('should return a success Result when del is successful', async () => {
      vi.mocked(redisClient.del).mockResolvedValue(1);

      const result = await cache.del('key');

      expect(result.success).toBe(true);
      expect(redisClient.del).toHaveBeenCalledWith('key');
    });
  });
});
