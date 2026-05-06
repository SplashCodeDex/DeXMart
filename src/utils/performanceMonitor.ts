/**
 * Performance Monitoring & Metrics Collection
 * Provides comprehensive performance tracking and optimization insights
 */

import { performance, PerformanceObserver, PerformanceEntry } from "node:perf_hooks";
const setImmediate = globalThis.setImmediate || ((fn: any) => setTimeout(fn, 0));
import { EventEmitter } from "events";
import logger from "./logger.js";

interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  metadata: any;
}

interface Thresholds {
  [key: string]: number;
  slow_operation: number;
  very_slow_operation: number;
  memory_warning: number;
  memory_critical: number;
  cpu_warning: number;
  cpu_critical: number;
}

export class PerformanceMonitor extends EventEmitter {
  metrics: Map<string, Metric[]>;
  thresholds: Thresholds;
  observerActive: boolean;
  baselineMemory?: number;

  constructor() {
    super();
    this.metrics = new Map();
    this.thresholds = {
      slow_operation: 1000, // 1 second
      very_slow_operation: 5000, // 5 seconds
      memory_warning: 1536, // 1.5 GB
      memory_critical: 2048, // 2 GB
      cpu_warning: 80, // 80%
      cpu_critical: 95, // 95%
    };

    this.observerActive = false;
    this.startMonitoring();
  }

  startMonitoring() {
    // Performance observer for measuring operations
    if (!this.observerActive) {
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordPerformanceEntry(entry);
          }
        });

        obs.observe({ entryTypes: ["measure", "mark"] });
        this.observerActive = true;
        logger.debug("Performance monitoring started");
      } catch (error: any) {
        logger.warn("Failed to start performance observer", { error: error.message });
      }
    }

    // Periodic system metrics collection
    this.startPeriodicMetrics();
  }

  startPeriodicMetrics() {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Memory monitoring every 10 seconds
    setInterval(() => {
      this.monitorMemoryUsage();
    }, 10000);
  }

  // Timer for measuring function execution
  startTimer(name: string, metadata: any = {}) {
    const markName = `${name}_start`;
    performance.mark(markName);

    return {
      end: () => {
        const endMarkName = `${name}_end`;
        performance.mark(endMarkName);
        performance.measure(name, markName, endMarkName);

        const entries = performance.getEntriesByName(name);
        const latestEntry = entries[entries.length - 1];

        if (latestEntry) {
          this.recordMetric(name, latestEntry.duration, "duration", metadata);

          // Check for slow operations
          if (latestEntry.duration > this.thresholds.very_slow_operation) {
            logger.warn("Very slow operation detected", {
              operation: name,
              duration: Math.round(latestEntry.duration),
              threshold: this.thresholds.very_slow_operation,
              ...metadata,
            });
            this.emit("slow_operation", {
              name,
              duration: latestEntry.duration,
              severity: "critical",
            });
          } else if (latestEntry.duration > this.thresholds.slow_operation) {
            logger.info("Slow operation detected", {
              operation: name,
              duration: Math.round(latestEntry.duration),
              threshold: this.thresholds.slow_operation,
              ...metadata,
            });
            this.emit("slow_operation", {
              name,
              duration: latestEntry.duration,
              severity: "warning",
            });
          }
        }

        // Clean up marks
        performance.clearMarks(markName);
        performance.clearMarks(endMarkName);
        // Clearing measures can prevent seeing historical data if we relied on P.getEntries() elsewhere
        // But we store in this.metrics so it is fine.
        performance.clearMeasures(name);

        return latestEntry ? latestEntry.duration : null;
      },
    };
  }

  // Decorator for automatic function timing
  timed(name?: string, metadata: any = {}) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const timer = this.startTimer
          ? this.startTimer(name || `${target.constructor.name}.${propertyKey}`, metadata)
          : performanceMonitor.startTimer(
              name || `${target.constructor.name}.${propertyKey}`,
              metadata,
            );
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const result = await originalMethod.apply(this, args);
          timer.end();
          return result;
        } catch (error: any) {
          timer.end();
          throw error;
        }
      };

      return descriptor;
    };
  }

  // High-level operation tracking
  async measureAsync<T>(name: string, operation: () => Promise<T>, metadata: any = {}): Promise<T> {
    const timer = this.startTimer(name, metadata);
    try {
      const result = await operation();
      timer.end();
      return result;
    } catch (error: any) {
      timer.end();
      throw error;
    }
  }

  measureSync<T>(name: string, operation: () => T, metadata: any = {}): T {
    const timer = this.startTimer(name, metadata);
    try {
      const result = operation();
      timer.end();
      return result;
    } catch (error: any) {
      timer.end();
      throw error;
    }
  }

  recordPerformanceEntry(entry: PerformanceEntry) {
    this.recordMetric(entry.name, entry.duration, "duration", {
      entryType: entry.entryType,
      startTime: entry.startTime,
    });
  }

  recordMetric(name: string, value: number, unit: string = "count", metadata: any = {}) {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only last 1000 metrics per name
    if (metrics.length > 1000) {
      metrics.shift();
    }

    // Emit metric event
    this.emit("metric", metric);

    logger.performance(name, value, { ...metadata, unit });
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    this.recordMetric("memory_heap_used", memUsage.heapUsed, "bytes");
    this.recordMetric("memory_heap_total", memUsage.heapTotal, "bytes");
    this.recordMetric("memory_rss", memUsage.rss, "bytes");
    this.recordMetric("memory_external", memUsage.external, "bytes");

    // CPU metrics (these are cumulative since process start)
    this.recordMetric("cpu_user_time", cpuUsage.user, "microseconds");
    this.recordMetric("cpu_system_time", cpuUsage.system, "microseconds");

    // Event loop lag
    this.measureEventLoopLag();

    // Process uptime
    this.recordMetric("process_uptime", process.uptime(), "seconds");
  }

  measureEventLoopLag() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
      this.recordMetric("event_loop_lag", lag, "milliseconds");

      if (lag > 100) {
        // More than 100ms lag
        logger.warn("High event loop lag detected", { lag: Math.round(lag) });
        this.emit("event_loop_lag", { lag, severity: lag > 1000 ? "critical" : "warning" });
      }
    });
  }

  monitorMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const rssMB = usage.rss / 1024 / 1024;

    if (rssMB > this.thresholds.memory_critical) {
      logger.error("Critical memory usage detected", {
        rss: Math.round(rssMB),
        heapUsed: Math.round(heapUsedMB),
        threshold: this.thresholds.memory_critical,
      });
      this.emit("memory_pressure", { level: "critical", rss: rssMB, heapUsed: heapUsedMB });
    } else if (rssMB > this.thresholds.memory_warning) {
      logger.warn("High memory usage detected", {
        rss: Math.round(rssMB),
        heapUsed: Math.round(heapUsedMB),
        threshold: this.thresholds.memory_warning,
      });
      this.emit("memory_pressure", { level: "warning", rss: rssMB, heapUsed: heapUsedMB });
    }
  }

  // Get metric statistics
  getMetricStats(name: string, timeWindow = 300000) {
    // Last 5 minutes by default
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const cutoff = Date.now() - timeWindow;
    const recentMetrics = metrics.filter((m) => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return null;
    }

    const values = recentMetrics.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate percentiles
    const sorted = [...values].sort((a, b) => a - b);
    const p50 = this.percentile(sorted, 0.5);
    const p90 = this.percentile(sorted, 0.9);
    const p95 = this.percentile(sorted, 0.95);
    const p99 = this.percentile(sorted, 0.99);

    return {
      name,
      count: recentMetrics.length,
      timeWindow,
      sum,
      avg,
      min,
      max,
      percentiles: { p50, p90, p95, p99 },
    };
  }

  percentile(sortedArray: number[], p: number) {
    const index = p * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedArray.length) return sortedArray[lower];

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  // Get all metrics summary
  getMetricsSummary(timeWindow = 300000) {
    const summary: any = {};

    for (const [name] of this.metrics) {
      const stats = this.getMetricStats(name, timeWindow);
      if (stats) {
        summary[name] = stats;
      }
    }

    return summary;
  }

  // Database query performance tracking
  trackDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    rowCount: number | null = null,
  ) {
    this.recordMetric("database_query_duration", duration, "milliseconds", {
      operation,
      table,
      rowCount,
    });

    this.recordMetric(`database_${operation}_duration`, duration, "milliseconds", {
      table,
      rowCount,
    });

    if (duration > 1000) {
      logger.warn("Slow database query detected", {
        operation,
        table,
        duration: Math.round(duration),
        rowCount,
      });
    }
  }

  // API call performance tracking
  trackApiCall(service: string, endpoint: string, duration: number, statusCode: number) {
    this.recordMetric("external_api_duration", duration, "milliseconds", {
      service,
      endpoint,
      statusCode,
      success: statusCode >= 200 && statusCode < 300,
    });

    this.recordMetric(`api_${service}_duration`, duration, "milliseconds", {
      endpoint,
      statusCode,
    });
  }

  // Memory leak detection
  detectMemoryLeaks() {
    const usage = process.memoryUsage();
    const currentHeapUsed = usage.heapUsed / 1024 / 1024;

    if (!this.baselineMemory) {
      this.baselineMemory = currentHeapUsed;
      return;
    }

    const growth = currentHeapUsed - this.baselineMemory;
    const growthPercent = (growth / this.baselineMemory) * 100;

    if (growthPercent > 50) {
      // 50% growth
      logger.warn("Potential memory leak detected", {
        baseline: Math.round(this.baselineMemory),
        current: Math.round(currentHeapUsed),
        growth: Math.round(growth),
        growthPercent: Math.round(growthPercent),
      });

      this.emit("memory_leak_warning", {
        baseline: this.baselineMemory,
        current: currentHeapUsed,
        growth,
        growthPercent,
      });
    }
  }

  // Performance report generation
  generateReport(timeWindow = 3600000) {
    // Last hour
    const summary = this.getMetricsSummary(timeWindow);
    const memoryUsage = process.memoryUsage();

    return {
      timestamp: new Date().toISOString(),
      timeWindow,
      systemMetrics: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        uptime: process.uptime(),
      },
      metrics: summary,
      thresholds: this.thresholds,
    };
  }

  // Clear old metrics
  clearOldMetrics(olderThan = 3600000) {
    // 1 hour
    const cutoff = Date.now() - olderThan;

    for (const [name, metrics] of this.metrics) {
      const filtered = metrics.filter((m) => m.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }
  }

  // Set custom thresholds
  setThreshold(name: string, value: number) {
    this.thresholds[name] = value;
    logger.debug(`Performance threshold updated: ${name} = ${value}`);
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
