import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

describe('ConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('should validate and load valid configuration', async () => {
    process.env.PORT = '3000';
    process.env.NODE_ENV = 'test';
    
    const { ConfigService } = await import('./ConfigService.js');
    const config = ConfigService.getInstance();

    expect(config.get('system.port')).toBe(3000);
    expect(config.server.environment).toBe('test');
  });

  it('should return default values for optional variables', async () => {
    delete process.env.PORT;
    process.env.NODE_ENV = 'development';

    const { ConfigService } = await import('./ConfigService.js');
    const config = ConfigService.getInstance();
    
    // Default for PORT in env.schema.ts is 3001
    expect(config.get('system.port')).toBe(3001);
  });

  it('should load environment variables correctly', async () => {
    process.env.REDIS_HOST = 'redis-server';
    process.env.BOT_COOLDOWN_MS = '2000';

    const { ConfigService } = await import('./ConfigService.js');
    const config = ConfigService.getInstance();

    expect(config.get('redis.host')).toBe('redis-server');
    expect(config.system.cooldown).toBe(2000);
  });
});
