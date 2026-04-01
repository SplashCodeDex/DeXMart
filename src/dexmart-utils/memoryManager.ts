/**
 * Memory Manager with TTL and Size Limits
 * Prevents unbounded growth and memory leaks
 */

interface MemoryManagerOptions {
  maxSize?: number;
  ttl?: number;
  cleanupInterval?: number;
}

interface MemoryItem<T> {
  value: T;
  expiresAt: number;
}

export class MemoryManager<T = any> {
  private maxSize: number;
  private ttl: number;
  private cleanupInterval: number;
  private data: Map<string, MemoryItem<T>>;
  private accessTimes: Map<string, number>;

  constructor(options: MemoryManagerOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 3600000; // 1 hour default
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    this.data = new Map();
    this.accessTimes = new Map();
    
    this.startCleanupTimer();
  }

  set(key: string, value: T, customTTL: number | null = null): void {
    if (this.data.size >= this.maxSize) {
      this.evictLRU();
    }

    const ttl = customTTL || this.ttl;
    const expiresAt = Date.now() + ttl;
    
    this.data.set(key, { value, expiresAt });
    this.accessTimes.set(key, Date.now());
  }

  get(key: string): T | null {
    const item = this.data.get(key);
    
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    this.accessTimes.set(key, Date.now());
    return item.value;
  }

  delete(key: string): void {
    this.data.delete(key);
    this.accessTimes.delete(key);
  }

  has(key: string): boolean {
    const item = this.data.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, accessTime] of this.accessTimes) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.data) {
      if (now > item.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
  }

  private startCleanupTimer(): void {
    const timer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
    timer.unref();
  }

  getStats() {
    return {
      size: this.data.size,
      maxSize: this.maxSize,
      memoryUsage: (this.data.size / this.maxSize) * 100
    };
  }

  clear(): void {
    this.data.clear();
    this.accessTimes.clear();
  }
}

export default MemoryManager;