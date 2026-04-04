/**
 * Persistent Rate Limiter using Redis
 * Fixes primitive rate limiting that resets on restart
 */
import { Redis } from 'ioredis';
import logger from './logger.js';

interface RateLimitConfig {
  requests: number;
  window: number;
}

interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetTime?: number | null;
  error?: string;
}

interface CheckItem {
  key: string;
  type: string;
  limit?: RateLimitConfig;
}

interface MultipleCheckResult {
  allowed: boolean;
  failedCheck?: CheckItem;
  results: Array<CheckItem & { result: RateLimitResult }>;
}

export class RateLimiter {
  private redis: Redis;
  private defaultLimits: any;

  constructor(redisClient: Redis, options: any = {}) {
    if (!redisClient) {
      throw new Error('RateLimiter requires a valid redisClient instance.');
    }
    this.redis = redisClient;

    // Default rate limit configurations from options or fallback
    this.defaultLimits = options.limits || {
      global: { requests: 100, window: 60 },
      user: { requests: 30, window: 60 },
      command: { requests: 10, window: 60 },
      ai: { requests: 5, window: 300 },
      download: { requests: 3, window: 60 },
      premium: { requests: 100, window: 60 }
    };
  }

  async checkLimit(key: string, type: string = 'user', customLimit: RateLimitConfig | null = null): Promise<RateLimitResult> {
    try {
      const limit = customLimit || this.defaultLimits[type];
      if (!limit) {
        throw new Error(`Unknown rate limit type: ${type}`);
      }

      const redisKey = `ratelimit:${type}:${key}`;
      const multi = this.redis.multi();

      multi.incr(redisKey);
      multi.expire(redisKey, limit.window);

      const results = await multi.exec();
      if (!results) {
        throw new Error('Redis transaction failed');
      }
      const currentCount = results[0][1] as number; // incr returns the new value

      if (currentCount > limit.requests) {
        const ttl = await this.redis.ttl(redisKey);
        return {
          allowed: false,
          current: currentCount,
          limit: limit.requests,
          remaining: 0,
          resetTime: ttl > 0 ? Date.now() + (ttl * 1000) : null
        };
      }

      return {
        allowed: true,
        current: currentCount,
        limit: limit.requests,
        remaining: limit.requests - currentCount,
        resetTime: Date.now() + (limit.window * 1000)
      };

    } catch (error: any) {
      logger.error('Rate limiting error:', error);
      // Fail open - allow request if rate limiter is down
      return {
        allowed: true,
        current: 0,
        limit: 1000,
        remaining: 999,
        error: error.message
      };
    }
  }

  async checkMultiple(checks: CheckItem[]): Promise<MultipleCheckResult> {
    const results: Array<CheckItem & { result: RateLimitResult }> = [];

    for (const check of checks) {
      const result = await this.checkLimit(check.key, check.type, check.limit);
      results.push({ ...check, result });

      if (!result.allowed) {
        return { allowed: false, failedCheck: check, results };
      }
    }

    return { allowed: true, results };
  }

  // Bridge for commands that expect checkCommandRateLimit
  async checkCommandRateLimit(userId: string, command: string, userTier: string = 'user'): Promise<MultipleCheckResult> {
    return this.isRateLimited(userId, command, userTier);
  }

  // Refactored to accept userTier directly, removing the need for the placeholder getUserTier
  async isRateLimited(userId: string, command: string, userTier: string = 'user'): Promise<MultipleCheckResult> {
    const checks: CheckItem[] = [
      { key: 'global', type: 'global' },
      { key: userId, type: userTier }, // Use the passed userTier
      { key: `${userId}:${command}`, type: 'command' }
    ];

    // Special limits for resource-intensive commands
    if (['gemini', 'dalle', 'gpt'].includes(command)) {
      checks.push({ key: `${userId}:ai`, type: 'ai' });
    }

    if (['youtubedl', 'tiktokedl', 'instagramdl'].includes(command)) {
      checks.push({ key: `${userId}:download`, type: 'download' });
    }

    return this.checkMultiple(checks);
  }

  // Sliding window rate limiter for more precise control
  async slidingWindowCheck(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;

      const redisKey = `sliding:${key}`;
      const multi = this.redis.multi();

      // Remove old entries
      multi.zremrangebyscore(redisKey, '-inf', windowStart);

      // Count current requests
      multi.zcard(redisKey);

      // Add current request
      multi.zadd(redisKey, now.toString(), `${now}-${Math.random()}`); // Score as string, member as string

      // Set expiry
      multi.expire(redisKey, Math.ceil(windowMs / 1000));

      const results = await multi.exec();
      if (!results) {
        throw new Error('Redis transaction failed');
      }
      const currentCount = results[1][1] as number; // zcard result

      if (currentCount >= limit) {
        return {
          allowed: false,
          current: currentCount + 1, // +1 for the current request that was just added
          limit,
          remaining: 0
        };
      }

      return {
        allowed: true,
        current: currentCount + 1,
        limit,
        remaining: limit - currentCount - 1
      };

    } catch (error: any) {
      logger.error('Sliding window rate limit error:', error);
      return { allowed: true, error: error.message, current: 0, limit: 0, remaining: 0 }; // Return a full RateLimitResult
    }
  }

  // Get rate limit status for user
  async getStatus(userId: string, userTier: string = 'user'): Promise<{ tier: string; limits: { [key: string]: { current: number; resetIn: number } } } | { error: string }> {
    try {
      const keys = [
        `ratelimit:${userTier}:${userId}`,
        `ratelimit:command:${userId}`,
        `ratelimit:ai:${userId}:ai`, // This key format seems inconsistent with checkCommandRateLimit
        `ratelimit:download:${userId}:download` // This key format seems inconsistent with checkCommandRateLimit
      ];

      const pipeline = this.redis.pipeline();
      keys.forEach(key => {
        pipeline.get(key);
        pipeline.ttl(key);
      });

      const results = await pipeline.exec();
      if (!results) {
        return { error: 'Redis pipeline failed' };
      }
      const status: { [key: string]: { current: number; resetIn: number } } = {};

      for (let i = 0; i < keys.length; i += 2) {
        const keyName = keys[i / 2].split(':').pop() || 'unknown';
        const count = results[i] ? (results[i][1] as string | null) : null;
        const ttl = results[i + 1] ? (results[i + 1][1] as number) : 0;

        status[keyName] = {
          current: parseInt(count || '0', 10),
          resetIn: ttl > 0 ? ttl : 0
        };
      }

      return { tier: userTier, limits: status };

    } catch (error: any) {
      logger.error('Error getting rate limit status:', error);
      return { error: error.message };
    }
  }

  async resetUserLimits(userId: string): Promise<{ reset: number } | { error: string }> {
    try {
      const pattern = `ratelimit:*:${userId}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      return { reset: keys.length };
    } catch (error: any) {
      logger.error('Error resetting rate limits:', error);
      return { error: error.message };
    }
  }

  async disconnect() {
    await this.redis.quit();
  }
}
