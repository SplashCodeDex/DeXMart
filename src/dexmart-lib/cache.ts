import crypto from 'crypto';
import redisClient from './redis.js';
import { Result } from '../types/index.js';

class Cache {
  private readonly redis: typeof redisClient;
  private readonly defaultTTL: number;

  constructor() {
    this.redis = redisClient;
    this.defaultTTL = 3600; // 1 hour
  }

  createKey(data: unknown): string {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  async get<T>(key: string): Promise<Result<T | null>> {
    try {
      const data = await this.redis.get(key);
      return {
        success: true,
        data: data ? (JSON.parse(data) as T) : null
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown cache get error')
      };
    }
  }

  async set(key: string, value: unknown, ttl: number = this.defaultTTL): Promise<Result<boolean>> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
      return { success: true, data: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown cache set error')
      };
    }
  }

  async del(key: string): Promise<Result<boolean>> {
    try {
      await this.redis.del(key);
      return { success: true, data: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown cache del error')
      };
    }
  }

  /**
   * Invalidate all keys matching a pattern (e.g., 'gemini:*')
   * Note: KEYS command can be slow on large datasets; consider SCAN for production
   */
  async invalidatePattern(pattern: string): Promise<Result<number>> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return { success: true, data: 0 };
      }
      await this.redis.del(...keys);
      return { success: true, data: keys.length };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown cache invalidate error')
      };
    }
  }
}

export const cache = new Cache();
export default cache;
