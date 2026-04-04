import logger from '../utils/logger.js';
import { databaseService } from './database.js'; // Use the new service
import { ActiveChannel, GlobalContext, MessageContext } from '../types/index.js';
import os from 'os';

interface Metrics {
  responseTimes: { endpoint: string; responseTime: number; statusCode: number; timestamp: number }[];
  commandUsage: Map<string, number>;
  errors: { error: string; context: any; timestamp: number }[];
  auditEvents: any[];
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  uptime: number;
}

class MonitoringService {
  private metrics: Metrics;

  constructor() {
    this.metrics = {
      responseTimes: [],
      commandUsage: new Map(),
      errors: [],
      auditEvents: [],
      activeConnections: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      uptime: 0,
    };

    // Start periodic collection
    this.startPeriodicCollection();
  }

  async recordResponseTime(endpoint: string, responseTime: number, statusCode: number) {
    this.metrics.responseTimes.push({ endpoint, responseTime, statusCode, timestamp: Date.now() });
    if (this.metrics.responseTimes.length > 1000) this.metrics.responseTimes.shift();
  }

  async recordCommandUsage(command: string, userId: string, success = true, executionTime: number | null = null) {
    const key = `${command}:${success ? 'success' : 'failure'}`;
    this.metrics.commandUsage.set(key, (this.metrics.commandUsage.get(key) || 0) + 1);
  }

  async recordError(error: any, context: any = {}) {
    this.metrics.errors.push({
      error: error.message || String(error),
      context,
      timestamp: Date.now(),
    });
    if (this.metrics.errors.length > 100) this.metrics.errors.shift();
  }

  async recordAuditEvent(event: any) {
    this.metrics.auditEvents.push({
      ...event,
      timestamp: Date.now(),
    });
    if (this.metrics.auditEvents.length > 100) this.metrics.auditEvents.shift();
  }

  async getMetrics() {
    return {
      responseTimes: this.calculateResponseTimeStats(),
      commandUsage: Object.fromEntries(this.metrics.commandUsage),
      activeUsers: this.metrics.activeConnections,
      systemHealth: {
        memory: this.metrics.memoryUsage,
        cpu: this.metrics.cpuUsage,
        uptime: this.metrics.uptime,
      },
      recentErrors: this.metrics.errors.slice(-10),
    };
  }

  calculateResponseTimeStats() {
    if (this.metrics.responseTimes.length === 0) return { avg: 0, p95: 0, p99: 0 };

    const times = this.metrics.responseTimes.map(m => m.responseTime).sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];

    return { avg, p95, p99 };
  }

  startPeriodicCollection() {
    setInterval(() => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      this.metrics.memoryUsage = Math.round(used * 100) / 100;
      this.metrics.uptime = process.uptime();

      // Calculate approximate CPU usage from load average
      const load = os.loadavg()[0];
      const cores = os.cpus().length;
      this.metrics.cpuUsage = Math.min(100, Math.round((load / cores) * 100));
    }, 5000);
  }
}

export const monitoringService = new MonitoringService();
export default monitoringService;
