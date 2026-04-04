/**
 * Comprehensive Health Check & Monitoring Service
 */

import os from 'os';
import { performance } from 'perf_hooks';
import dbManager from '../utils/databaseManager.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import logger from '../utils/logger.js';
import redis from '../lib/redis.js';
import { Result } from '../types/index.js';
import { Express, Request, Response } from 'express';

interface HealthResult {
  status: 'healthy' | 'unhealthy' | 'warning';
  details?: any;
  responseTime?: number;
  critical?: boolean;
  error?: string;
  timestamp?: string;
  duration?: number;
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private startTime: number;
  private healthChecks: Map<string, () => Promise<HealthResult>>;
  private metrics: Map<string, any[]>;
  private rateLimiter: RateLimiter;

  private constructor() {
    this.startTime = Date.now();
    this.healthChecks = new Map();
    this.metrics = new Map();
    this.rateLimiter = new RateLimiter(redis);

    this.registerDefaultChecks();
    this.startPeriodicChecks();
  }

  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  private registerDefaultChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      const start = performance.now();
      try {
        const health = await dbManager.healthCheck();
        return {
          status: health.connected ? 'healthy' : 'unhealthy',
          details: health,
          responseTime: Math.round(performance.now() - start),
          critical: true
        };
      } catch (error: unknown) {
        return {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error),
          critical: true
        };
      }
    });

    // Redis health check
    this.registerHealthCheck('redis', async () => {
      const start = performance.now();
      try {
        await redis.ping();
        return {
          status: 'healthy',
          responseTime: Math.round(performance.now() - start),
          critical: true
        };
      } catch (error: unknown) {
        return {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error),
          critical: true
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const usage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      const heapUsage = (usage.heapUsed / usage.heapTotal) * 100;
      const systemUsage = (usedMem / totalMem) * 100;
      const status = heapUsage > 85 || systemUsage > 90 ? 'warning' : 'healthy';

      return {
        status,
        details: {
          heap: { used: Math.round(usage.heapUsed / 1024 / 1024), total: Math.round(usage.heapTotal / 1024 / 1024), usage: Math.round(heapUsage) },
          system: { used: Math.round(usedMem / 1024 / 1024), total: Math.round(totalMem / 1024 / 1024), usage: Math.round(systemUsage) }
        }
      };
    });
  }

  public registerHealthCheck(name: string, checkFunction: () => Promise<HealthResult>): void {
    this.healthChecks.set(name, checkFunction);
    logger.debug(`Health check registered: ${name}`);
  }

  async runHealthCheck(name: string): Promise<HealthResult> {
    const checkFunction = this.healthChecks.get(name);
    if (!checkFunction) {
      throw new Error(`Health check '${name}' not found`);
    }

    const start = performance.now();
    try {
      const result = await Promise.race([
        checkFunction(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);

      return {
        ...result,
        duration: Math.round(performance.now() - start),
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        duration: Math.round(performance.now() - start),
        timestamp: new Date().toISOString()
      };
    }
  }

  async runAllHealthChecks(): Promise<Result<{ status: string; checks: Record<string, HealthResult> }>> {
    const results: Record<string, HealthResult> = {};
    const checks = Array.from(this.healthChecks.keys());

    for (const name of checks) {
      results[name] = await this.runHealthCheck(name);
    }

    const hasUnhealthyCritical = Object.values(results).some(r => r.critical && r.status === 'unhealthy');
    const hasWarnings = Object.values(results).some(r => r.status === 'warning');

    const status = hasUnhealthyCritical ? 'unhealthy' : hasWarnings ? 'warning' : 'healthy';

    return {
      success: true,
      data: { status, checks: results }
    };
  }

  async getSystemInfo() {
    const memoryUsage = process.memoryUsage();
    return {
      service: 'DeXMart Channel',
      version: '1.0.0',
      uptime: this.getUptime(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024)
      }
    };
  }

  getUptime() {
    const uptimeMs = Date.now() - this.startTime;
    return {
      ms: uptimeMs,
      human: `${Math.floor(uptimeMs / 1000)}s`
    };
  }

  startPeriodicChecks() {
    setInterval(async () => {
      const result = await this.runAllHealthChecks();
      if (result.success && result.data.status !== 'healthy') {
        logger.warn('System health check issue detected', result.data);
      }
    }, 60000);
  }

  createHealthEndpoints(app: Express) {
    app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: this.getUptime().human });
    });

    app.get('/health/ready', async (_req: Request, res: Response) => {
      const result = await this.runAllHealthChecks();
      if (result.success) {
        res.status(result.data.status === 'unhealthy' ? 503 : 200).json(result.data);
      } else {
        res.status(500).json({ status: 'error', error: result.error.message });
      }
    });
  }

  async gracefulShutdown() {
    logger.info('Starting graceful shutdown...');
    try {
      await redis.quit();
      logger.info('Graceful shutdown completed');
    } catch (error: unknown) {
      logger.error('Error during graceful shutdown', error);
    }
  }
}

export const healthCheckService = HealthCheckService.getInstance();
export default healthCheckService;
