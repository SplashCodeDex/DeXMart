import redis from '../lib/redis.js';
import logger from '../utils/logger.js';
import { Result } from '../types/index.js';
import NodeCache from 'node-cache';

export class CacheService {
  private static instance: CacheService;
  private client: typeof redis;
  private memoryCache: NodeCache;
  private isConnected: boolean;
  private useMemoryFallback: boolean;
  private defaultTTL: number;

  private constructor() {
    this.client = redis;
    this.isConnected = false;
    this.useMemoryFallback = true;
    this.defaultTTL = 3600; // 1 hour

    // Initialize memory cache as fallback
    this.memoryCache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: 120
    });

    this.setupListeners();
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private setupListeners(): void {
    this.client.on('error', (err: Error) => {
      // Don't flood logs with connection errors if we're using fallback
      if (this.isConnected) {
        logger.error('Redis Error:', err);
      }
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('✅ Redis Connected - Switching to distributed cache');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.warn('⚠️ Redis Connection Ended - Falling back to memory cache');
    });
  }

  createKey(data: any): string {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    return `cache:${Buffer.from(serialized).toString('base64').substring(0, 32)}`;
  }

  async get<T>(key: string): Promise<Result<T | null>> {
    if (!this.isConnected) {
      if (this.useMemoryFallback) {
        const val = this.memoryCache.get<T>(key);
        return { success: true, data: val !== undefined ? val : null };
      }
      return { success: false, error: new Error('Cache not connected') };
    }

    try {
      const value = await this.client.get(key);
      if (!value) return { success: true, data: null };

      try {
        const data = JSON.parse(value) as T;
        return { success: true, data };
      } catch (parseError) {
        return { success: true, data: value as unknown as T };
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Cache.get error [${key}]:`, err);
      return { success: false, error: err };
    }
  }

  async set(key: string, value: any, ttlSeconds: number = this.defaultTTL): Promise<Result<void>> {
    // Always update memory cache if enabled
    if (this.useMemoryFallback) {
      this.memoryCache.set(key, value, ttlSeconds);
    }

    if (!this.isConnected) {
      return this.useMemoryFallback
        ? { success: true, data: undefined }
        : { success: false, error: new Error('Cache not connected') };
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.set(key, serializedValue, 'EX', ttlSeconds);
      return { success: true, data: undefined };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Cache.set error [${key}]:`, err);
      return { success: false, error: err };
    }
  }

  async delete(key: string): Promise<Result<void>> {
    if (this.useMemoryFallback) {
      this.memoryCache.del(key);
    }

    if (!this.isConnected) {
      return this.useMemoryFallback
        ? { success: true, data: undefined }
        : { success: false, error: new Error('Cache not connected') };
    }

    try {
      await this.client.del(key);
      return { success: true, data: undefined };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Cache.delete error [${key}]:`, err);
      return { success: false, error: err };
    }
  }

  async exists(key: string): Promise<Result<boolean>> {
    if (!this.isConnected) {
      if (this.useMemoryFallback) {
        return { success: true, data: this.memoryCache.has(key) };
      }
      return { success: false, error: new Error('Cache not connected') };
    }

    try {
      const result = await this.client.exists(key);
      return { success: true, data: result === 1 };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Cache.exists error [${key}]:`, err);
      return { success: false, error: err };
    }
  }

  async mset(keyValuePairs: Record<string, any>, ttlSeconds: number = this.defaultTTL): Promise<Result<void>> {
    if (this.useMemoryFallback) {
      for (const [key, value] of Object.entries(keyValuePairs)) {
        this.memoryCache.set(key, value, ttlSeconds);
      }
    }

    if (!this.isConnected) {
      return this.useMemoryFallback
        ? { success: true, data: undefined }
        : { success: false, error: new Error('Cache not connected') };
    }

    try {
      const pipeline = this.client.pipeline();
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        pipeline.set(key, serializedValue, 'EX', ttlSeconds);
      }
      await pipeline.exec();
      return { success: true, data: undefined };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Cache.mset error:', err);
      return { success: false, error: err };
    }
  }

  async increment(key: string, amount: number = 1): Promise<Result<number>> {
    // In-memory increment
    let newVal = amount;
    if (this.useMemoryFallback) {
      const current = this.memoryCache.get<number>(key) || 0;
      newVal = current + amount;
      this.memoryCache.set(key, newVal);
    }

    if (!this.isConnected) {
      return this.useMemoryFallback
        ? { success: true, data: newVal }
        : { success: false, error: new Error('Cache not connected') };
    }

    try {
      const result = await this.client.incrby(key, amount);
      return { success: true, data: result };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Cache.increment error [${key}]:`, err);
      return { success: false, error: err };
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<Result<boolean>> {
    if (this.useMemoryFallback) {
      this.memoryCache.ttl(key, ttlSeconds);
    }

    if (!this.isConnected) {
      return this.useMemoryFallback
        ? { success: true, data: this.memoryCache.has(key) }
        : { success: false, error: new Error('Cache not connected') };
    }

    try {
      const result = await this.client.expire(key, ttlSeconds);
      return { success: true, data: result === 1 };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Cache.expire error [${key}]:`, err);
      return { success: false, error: err };
    }
  }

  async ttl(key: string): Promise<Result<number>> {
    if (!this.isConnected) {
      if (this.useMemoryFallback) {
        const ttl = this.memoryCache.getTtl(key);
        if (ttl === undefined) return { success: true, data: -2 };
        if (ttl === 0) return { success: true, data: -1 };
        return { success: true, data: Math.round((ttl - Date.now()) / 1000) };
      }
      return { success: false, error: new Error('Cache not connected') };
    }

    try {
      const result = await this.client.ttl(key);
      return { success: true, data: result };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Cache.ttl error [${key}]:`, err);
      return { success: false, error: err };
    }
  }

  async keys(pattern: string): Promise<Result<string[]>> {
    if (!this.isConnected) {
      if (this.useMemoryFallback) {
        // node-cache doesn't support pattern matching easily, return empty or all
        return { success: true, data: this.memoryCache.keys() };
      }
      return { success: false, error: new Error('Cache not connected') };
    }

    try {
      const keys = await this.client.keys(pattern);
      return { success: true, data: keys };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Cache.keys error [${pattern}]:`, err);
      return { success: false, error: err };
    }
  }

  async blacklistToken(token: string, expirySeconds: number): Promise<Result<void>> {
    const key = `blacklist:${token}`;
    return this.set(key, 'revoked', expirySeconds);
  }

  async isTokenBlacklisted(token: string): Promise<Result<boolean>> {
    const key = `blacklist:${token}`;
    return this.exists(key);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
    if (this.memoryCache) {
      this.memoryCache.close();
    }
  }
}

export const cacheService = CacheService.getInstance();
export default cacheService;
