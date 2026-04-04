import { RateLimiterRedis } from 'rate-limiter-flexible';
import logger from '../utils/logger.js';
import { createClient } from 'redis';

interface RateLimiterConfig {
  points: number;
  duration: number;
  keyPrefix?: string;
  blockDuration?: number;
}

interface RateLimitStatus {
  remainingPoints: number;
  msBeforeNext: number;
  consumedPoints: number;
  isBlocked: boolean;
  error?: string;
}

class RateLimiterService {
  private limiters: Map<string, any>;
  private redisClient: any; // Relaxed type to avoid Redis version mismatch issues without detailed check

  constructor() {
    this.limiters = new Map();
    this.redisClient = null;

    // Initialize Redis client
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
      });

      this.redisClient.on('error', (err: any) => {
        logger.error('Rate limiter Redis connection error:', err);
      });

      this.redisClient.on('connect', () => {
        logger.info('Rate limiter connected to Redis');
      });

      // Connect to Redis
      this.redisClient.connect().catch((err: any) => {
        logger.error('Failed to connect rate limiter to Redis:', err);
      });
    } catch (error: any) {
      logger.error('Failed to initialize Redis for rate limiter:', error);
    }
  }

  /**
   * Get or create a rate limiter for specific configuration
   */
  getLimiter(config: RateLimiterConfig): any {
    const key = `${config.points}:${config.duration}:${config.keyPrefix || 'default'}`;

    if (!this.limiters.has(key)) {
      if (!this.redisClient) {
        throw new Error('Redis client not available for rate limiting');
      }

      this.limiters.set(
        key,
        new RateLimiterRedis({
          storeClient: this.redisClient,
          points: config.points,
          duration: config.duration,
          keyPrefix: config.keyPrefix || 'rl',
          inMemoryBlockOnConsumed: config.points, // Block if consumed all points
          inMemoryBlockDuration: config.blockDuration || 60, // Block duration in seconds
          insuranceLimiter: new RateLimiterRedis({
            storeClient: this.redisClient,
            points: Math.floor(config.points / 2),
            duration: config.duration * 2,
            keyPrefix: `${config.keyPrefix || 'rl'}_insurance`,
          }),
        })
      );
    }

    return this.limiters.get(key)!;
  }

  /**
   * Check if request is allowed
   */
  async check(key: string, config: RateLimiterConfig): Promise<boolean> {
    try {
      const limiter = this.getLimiter(config);
      await limiter.consume(key);
      return true;
    } catch (rejRes: any) {
      logger.warn('Rate limit exceeded', {
        key,
        points: config.points,
        duration: config.duration,
        remainingPoints: rejRes.remainingPoints,
        msBeforeNext: rejRes.msBeforeNext,
      });
      return false;
    }
  }

  /**
   * Get rate limit status for a key
   */
  async getStatus(key: string, config: RateLimiterConfig): Promise<RateLimitStatus> {
    try {
      const limiter = this.getLimiter(config);
      const res = await limiter.get(key);

      return {
        remainingPoints: res ? res.remainingPoints : config.points,
        msBeforeNext: res ? res.msBeforeNext : 0,
        consumedPoints: res ? res.consumedPoints : 0,
        isBlocked: false,
      };
    } catch (error: any) {
      return {
        remainingPoints: 0,
        msBeforeNext: 0,
        consumedPoints: config.points,
        isBlocked: true,
        error: error.message,
      };
    }
  }

  /**
   * Block a key manually
   */
  async block(key: string, seconds: number, config: RateLimiterConfig): Promise<boolean> {
    try {
      const limiter = this.getLimiter(config);
      await limiter.block(key, seconds);
      logger.info('Manually blocked key', { key, seconds });
      return true;
    } catch (error: any) {
      logger.error('Failed to block key', { key, error: error.message });
      return false;
    }
  }

  /**
   * Unblock a key
   */
  async unblock(key: string, config: RateLimiterConfig): Promise<boolean> {
    try {
      const limiter = this.getLimiter(config);
      await limiter.delete(key);
      logger.info('Unblocked key', { key });
      return true;
    } catch (error: any) {
      logger.error('Failed to unblock key', { key, error: error.message });
      return false;
    }
  }

  /**
   * Penalize a key (consume extra points)
   */
  async penalize(key: string, points: number, config: RateLimiterConfig): Promise<boolean> {
    try {
      const limiter = this.getLimiter(config);
      await limiter.penalty(key, points);
      logger.info('Penalized key', { key, points });
      return true;
    } catch (error: any) {
      logger.error('Failed to penalize key', { key, error: error.message });
      return false;
    }
  }

  /**
   * Reward a key (reduce consumed points)
   */
  async reward(key: string, points: number, config: RateLimiterConfig): Promise<boolean> {
    try {
      const limiter = this.getLimiter(config);
      await limiter.reward(key, points);
      logger.info('Rewarded key', { key, points });
      return true;
    } catch (error: any) {
      logger.error('Failed to reward key', { key, error: error.message });
      return false;
    }
  }

  /**
   * Create predefined rate limiters for common use cases
   */
  createPresetLimiters() {
    return {
      // AI Chat commands - strict limits
      aiChat: {
        points: 20, // 20 requests
        duration: 60, // per minute
        keyPrefix: 'ai_chat',
      },

      // General commands - moderate limits
      generalCommands: {
        points: 50, // 50 requests
        duration: 60, // per minute
        keyPrefix: 'general',
      },

      // Media processing - lower limits due to resource usage
      mediaProcessing: {
        points: 10, // 10 requests
        duration: 60, // per minute
        keyPrefix: 'media',
      },

      // API endpoints - higher limits for web dashboard
      apiRequests: {
        points: 100, // 100 requests
        duration: 60, // per minute
        keyPrefix: 'api',
      },

      // File uploads - strict limits
      fileUploads: {
        points: 5, // 5 uploads
        duration: 300, // per 5 minutes
        keyPrefix: 'upload',
      },

      // Admin actions - very strict limits
      adminActions: {
        points: 10, // 10 actions
        duration: 60, // per minute
        keyPrefix: 'admin',
      },
    };
  }

  /**
   * Get rate limiter statistics
   */
  async getStats() {
    const stats: any = {
      connected: !!this.redisClient,
      limitersCount: this.limiters.size,
      limiters: [],
    };

    if (this.redisClient) {
      try {
        // Get Redis stats
        const redisInfo = await this.redisClient.info();
        stats.redis = this.parseRedisInfo(redisInfo as any);
      } catch (error: any) {
        stats.redis = { error: error.message };
      }
    }

    // Get limiter configurations
    for (const [key, limiter] of this.limiters) {
      stats.limiters.push({
        key,
        points: limiter.points,
        duration: limiter.duration,
        keyPrefix: limiter.keyPrefix,
      });
    }

    return stats;
  }

  /**
   * Parse Redis INFO command output
   */
  parseRedisInfo(info: string): Record<string, string> {
    const lines = info.split('\n');
    const parsed: Record<string, string> = {};

    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key] = value.trim();
      }
    });

    return parsed;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.redisClient) {
        return { status: 'disconnected', service: 'rate-limiter' };
      }

      await this.redisClient.ping();

      return {
        status: 'healthy',
        service: 'rate-limiter',
        limiters: this.limiters.size,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        service: 'rate-limiter',
        error: error.message,
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

export const rateLimiterService = new RateLimiterService();
export default rateLimiterService;
