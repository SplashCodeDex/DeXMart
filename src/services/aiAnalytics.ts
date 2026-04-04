import { db, admin } from '../lib/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import logger from '../utils/logger.js';
import { Result } from '../types/contracts.js';

/**
 * AI Analytics Service
 * Tracks AI-specific metrics: requests, response times, errors, token usage, etc.
 * 2026 Edition - Real Data Implementation
 */

interface AIRequestMetric {
  tenantId: string;
  userId: string;
  requestType: 'chat' | 'image_generation' | 'translation' | 'moderation' | 'batch_analysis' | 'fine_tuning' | 'summary';
  success: boolean;
  responseTime: number; // milliseconds
  tokensUsed?: number;
  errorMessage?: string;
  confidence?: number;
  toolsUsed?: string[];
  timestamp: Date;
}

interface AIPerformanceMetrics {
  totalRequests: number;
  averageResponseTime: number;
  successRate: number;
  popularFeatures: string[];
  userSatisfaction: number;
  errorRate: number;
  timeRange: string;
  generatedAt: string;
  featureBreakdown: Record<string, number>;
  hourlyDistribution: Record<string, number>;
}

class AIAnalyticsService {
  private metricsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Track an AI request
   */
  async trackAIRequest(metric: AIRequestMetric): Promise<Result<void>> {
    try {
      const tenantPath = `tenants/${metric.tenantId}`;
      
      // Store detailed request log
      await db.collection(`${tenantPath}/ai_requests`).add({
        userId: metric.userId,
        requestType: metric.requestType,
        success: metric.success,
        responseTime: metric.responseTime,
        tokensUsed: metric.tokensUsed || 0,
        errorMessage: metric.errorMessage || null,
        confidence: metric.confidence || null,
        toolsUsed: metric.toolsUsed || [],
        timestamp: Timestamp.fromDate(metric.timestamp)
      });

      // Update daily aggregates
      const date = metric.timestamp.toISOString().split('T')[0];
      await this.updateDailyAggregates(metric.tenantId, date, metric);

      // Clear cache for this tenant
      this.invalidateCache(metric.tenantId);

      return { success: true, data: undefined };
    } catch (error: any) {
      logger.error('Failed to track AI request', { error: error.message, metric });
      return { success: false, error };
    }
  }

  /**
   * Update daily AI analytics aggregates
   */
  private async updateDailyAggregates(tenantId: string, date: string, metric: AIRequestMetric): Promise<void> {
    const tenantPath = `tenants/${tenantId}`;
    const aggregateRef = db.doc(`${tenantPath}/ai_analytics_daily/${date}`);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(aggregateRef);
      const existing = (doc.exists ? doc.data() : {
        date,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalResponseTime: 0,
        totalTokens: 0,
        featureUsage: {},
        hourlyDistribution: {},
        updatedAt: new Date()
      }) as any;

      const hour = metric.timestamp.getHours();
      const hourKey = `hour_${hour}`;

      transaction.set(aggregateRef, {
        date,
        totalRequests: (existing.totalRequests || 0) + 1,
        successfulRequests: (existing.successfulRequests || 0) + (metric.success ? 1 : 0),
        failedRequests: (existing.failedRequests || 0) + (metric.success ? 0 : 1),
        totalResponseTime: (existing.totalResponseTime || 0) + metric.responseTime,
        totalTokens: (existing.totalTokens || 0) + (metric.tokensUsed || 0),
        featureUsage: {
          ...existing.featureUsage,
          [metric.requestType]: ((existing.featureUsage as any)?.[metric.requestType] || 0) + 1
        },
        hourlyDistribution: {
          ...existing.hourlyDistribution,
          [hourKey]: ((existing.hourlyDistribution as any)?.[hourKey] || 0) + 1
        },
        updatedAt: new Date()
      }, { merge: true });
    });
  }

  /**
   * Get AI performance analytics for a time range
   */
  async getPerformanceAnalytics(
    tenantId: string,
    userId: string | null,
    timeRange: string,
    metrics: string[]
  ): Promise<Result<AIPerformanceMetrics>> {
    try {
      // Check cache first
      const cacheKey = `${tenantId}:${userId || 'all'}:${timeRange}`;
      const cached = this.metricsCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        logger.info('Returning cached AI analytics', { tenantId, timeRange });
        return { success: true, data: cached.data };
      }

      // Calculate date range
      const { startDate, endDate } = this.calculateDateRange(timeRange);
      const tenantPath = `tenants/${tenantId}`;

      // Query AI requests within time range
      let query = db.collection(`${tenantPath}/ai_requests`)
        .where('timestamp', '>=', Timestamp.fromDate(startDate))
        .where('timestamp', '<=', Timestamp.fromDate(endDate));

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      const snapshot = await query.get();
      const requests = snapshot.docs.map(doc => doc.data());

      if (requests.length === 0) {
        return {
          success: true,
          data: this.getEmptyMetrics(timeRange)
        };
      }

      // Calculate metrics
      const analytics = this.calculateMetrics(requests, timeRange);

      // Cache the results
      this.metricsCache.set(cacheKey, {
        data: analytics,
        timestamp: Date.now()
      });

      return { success: true, data: analytics };
    } catch (error: any) {
      logger.error('Failed to get AI performance analytics', { error: error.message, tenantId, timeRange });
      return { success: false, error };
    }
  }

  /**
   * Calculate metrics from raw request data
   */
  private calculateMetrics(requests: any[], timeRange: string): AIPerformanceMetrics {
    const totalRequests = requests.length;
    const successfulRequests = requests.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    // Average response time
    const totalResponseTime = requests.reduce((sum, r) => sum + (r.responseTime || 0), 0);
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests / 1000 : 0; // Convert to seconds

    // Success rate
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    // Error rate
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    // Feature usage
    const featureUsage: Record<string, number> = {};
    requests.forEach(r => {
      const type = r.requestType || 'unknown';
      featureUsage[type] = (featureUsage[type] || 0) + 1;
    });

    // Popular features (top 5)
    const popularFeatures = Object.entries(featureUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([feature]) => feature);

    // User satisfaction (based on success rate and confidence)
    const confidenceScores = requests
      .filter(r => r.success && r.confidence)
      .map(r => r.confidence);
    
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length
      : 0;

    const userSatisfaction = (successRate / 100) * 0.7 + avgConfidence * 0.3; // Weighted average
    const userSatisfactionScore = parseFloat((userSatisfaction * 5).toFixed(1)); // Scale to 0-5

    // Hourly distribution
    const hourlyDistribution: Record<string, number> = {};
    requests.forEach(r => {
      const hour = new Date(r.timestamp.toDate()).getHours();
      const hourKey = `hour_${hour}`;
      hourlyDistribution[hourKey] = (hourlyDistribution[hourKey] || 0) + 1;
    });

    return {
      totalRequests,
      averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
      successRate: parseFloat(successRate.toFixed(2)),
      popularFeatures,
      userSatisfaction: userSatisfactionScore,
      errorRate: parseFloat(errorRate.toFixed(2)),
      timeRange,
      generatedAt: new Date().toISOString(),
      featureBreakdown: featureUsage,
      hourlyDistribution
    };
  }

  /**
   * Calculate Estimated ROI Contribution
   * Calculation: (Human Labor Cost - AI Token Cost)
   * Note: This is a simplified estimation for the 2026 dashboard.
   */
  public calculateROI(totalTokens: number, totalRequests: number): number {
    // Assumptions:
    // 1. Average human labor cost per "task" (request) = $0.50
    // 2. AI Cost per 1k tokens = $0.01 (blended rate)
    const humanLaborCost = totalRequests * 0.50;
    const aiTokenCost = (totalTokens / 1000) * 0.01;
    const estimatedSavings = humanLaborCost - aiTokenCost;
    
    // Return floor of 0 to avoid negative ROI on small sample sizes
    return Math.max(0, parseFloat(estimatedSavings.toFixed(2)));
  }

  /**
   * Calculate Resource Efficiency %
   * Calculation: (Success Rate * (1 - (Avg Latency / Max Acceptable Latency)))
   */
  public calculateEfficiency(successRatePercent: number, avgResponseTimeSec: number): number {
    const maxAcceptableLatency = 10.0; // 10 seconds is the threshold for "low efficiency"
    const latencyFactor = Math.max(0, 1 - (avgResponseTimeSec / maxAcceptableLatency));
    const efficiency = (successRatePercent / 100) * latencyFactor * 100;
    
    return Math.min(100, parseFloat(efficiency.toFixed(1)));
  }

  /**
   * Get empty metrics structure
   */
  private getEmptyMetrics(timeRange: string): AIPerformanceMetrics {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      successRate: 0,
      popularFeatures: [],
      userSatisfaction: 0,
      errorRate: 0,
      timeRange,
      generatedAt: new Date().toISOString(),
      featureBreakdown: {},
      hourlyDistribution: {}
    };
  }

  /**
   * Calculate date range from time range string
   */
  private calculateDateRange(timeRange: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7); // Default to 7 days
    }

    return { startDate, endDate };
  }

  /**
   * Invalidate cache for a tenant
   */
  private invalidateCache(tenantId: string): void {
    const keysToDelete: string[] = [];
    
    this.metricsCache.forEach((_, key) => {
      if (key.startsWith(`${tenantId}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.metricsCache.delete(key));
  }

  /**
   * Clean up old cache entries (call periodically)
   */
  cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.metricsCache.forEach((value, key) => {
      if (now - value.timestamp > this.cacheTTL) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.metricsCache.delete(key));
  }
}

export const aiAnalyticsService = new AIAnalyticsService();
export default aiAnalyticsService;
