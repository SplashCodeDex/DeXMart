import { CronJob } from 'cron';
import { db } from '../lib/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import logger from '../utils/logger.js';
import { aiAnalyticsService } from '../services/aiAnalytics.js';

/**
 * Analytics Aggregator
 * Runs daily to aggregate and clean up analytics data
 * 2026 Edition - Real Data Aggregation
 */

class AnalyticsAggregator {
  private dailyAggregationJob: CronJob | null = null;
  private cleanupJob: CronJob | null = null;

  /**
   * Initialize aggregation jobs
   */
  initialize() {
    // Run daily aggregation at 1 AM
    this.dailyAggregationJob = new CronJob(
      '0 1 * * *', // Every day at 1 AM
      async () => {
        logger.info('🔄 Running daily analytics aggregation...');
        await this.runDailyAggregation();
      },
      null,
      false,
      'UTC'
    );

    // Run cleanup weekly on Sunday at 2 AM
    this.cleanupJob = new CronJob(
      '0 2 * * 0', // Every Sunday at 2 AM
      async () => {
        logger.info('🧹 Running weekly analytics cleanup...');
        await this.runWeeklyCleanup();
      },
      null,
      false,
      'UTC'
    );

    this.dailyAggregationJob.start();
    this.cleanupJob.start();

    logger.info('✅ Analytics aggregation jobs initialized');
  }

  /**
   * Run daily aggregation for all tenants
   */
  private async runDailyAggregation() {
    try {
      const startTime = Date.now();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // Get all tenants
      const tenantsSnapshot = await db.collection('tenants').get();
      const tenants = tenantsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      logger.info(`Processing daily aggregation for ${tenants.length} tenants...`);

      let aggregatedCount = 0;
      let errorCount = 0;

      for (const tenant of tenants) {
        try {
          await this.aggregateTenantData(tenant.id, dateStr);
          aggregatedCount++;
        } catch (error: any) {
          logger.error(`Failed to aggregate data for tenant ${tenant.id}:`, error);
          errorCount++;
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`✅ Daily aggregation completed: ${aggregatedCount} succeeded, ${errorCount} failed in ${duration}ms`);
    } catch (error: any) {
      logger.error('Daily aggregation failed:', error);
    }
  }

  /**
   * Aggregate data for a specific tenant
   */
  private async aggregateTenantData(tenantId: string, dateStr: string) {
    const tenantPath = `tenants/${tenantId}`;

    // 1. Aggregate message stats
    const analyticsRef = db.doc(`${tenantPath}/analytics/${dateStr}`);
    const analyticsDoc = await analyticsRef.get();

    if (analyticsDoc.exists) {
      logger.debug(`Analytics already aggregated for ${tenantId} on ${dateStr}`);
      return;
    }

    // Get message counts from channels
    const channelsSnapshot = await db.collection(`${tenantPath}/channels`).get();
    const channels = channelsSnapshot.docs.map(doc => doc.data());

    const totalSent = channels.reduce((sum, channel) => sum + (channel.stats?.messagesSent || 0), 0);
    const totalReceived = channels.reduce((sum, channel) => sum + (channel.stats?.messagesReceived || 0), 0);
    const totalErrors = channels.reduce((sum, channel) => sum + (channel.stats?.errorsCount || 0), 0);

    // Store aggregated data
    await analyticsRef.set({
      date: dateStr,
      sent: totalSent,
      received: totalReceived,
      errors: totalErrors,
      updatedAt: Timestamp.now()
    });

    logger.debug(`Aggregated analytics for ${tenantId} on ${dateStr}: ${totalSent} sent, ${totalReceived} received`);

    // 2. Aggregate AI analytics (from ai_requests collection)
    await this.aggregateAIData(tenantId, dateStr);
  }

  /**
   * Aggregate AI analytics data
   */
  private async aggregateAIData(tenantId: string, dateStr: string) {
    const tenantPath = `tenants/${tenantId}`;
    const aiAggregateRef = db.doc(`${tenantPath}/ai_analytics_daily/${dateStr}`);

    const existingDoc = await aiAggregateRef.get();
    if (existingDoc.exists) {
      logger.debug(`AI analytics already aggregated for ${tenantId} on ${dateStr}`);
      return;
    }

    // Get all AI requests for the date
    const date = new Date(dateStr);
    const startOfDay = Timestamp.fromDate(new Date(date.setHours(0, 0, 0, 0)));
    const endOfDay = Timestamp.fromDate(new Date(date.setHours(23, 59, 59, 999)));

    const aiRequestsSnapshot = await db.collection(`${tenantPath}/ai_requests`)
      .where('timestamp', '>=', startOfDay)
      .where('timestamp', '<=', endOfDay)
      .get();

    if (aiRequestsSnapshot.empty) {
      logger.debug(`No AI requests found for ${tenantId} on ${dateStr}`);
      return;
    }

    const requests = aiRequestsSnapshot.docs.map(doc => doc.data());

    // Calculate aggregates
    const totalRequests = requests.length;
    const successfulRequests = requests.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const totalResponseTime = requests.reduce((sum, r) => sum + (r.responseTime || 0), 0);
    const totalTokens = requests.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    // Feature usage breakdown
    const featureUsage: Record<string, number> = {};
    requests.forEach(r => {
      const type = r.requestType || 'unknown';
      featureUsage[type] = (featureUsage[type] || 0) + 1;
    });

    // Hourly distribution
    const hourlyDistribution: Record<string, number> = {};
    requests.forEach(r => {
      const hour = r.timestamp.toDate().getHours();
      const hourKey = `hour_${hour}`;
      hourlyDistribution[hourKey] = (hourlyDistribution[hourKey] || 0) + 1;
    });

    // Store aggregated AI data
    await aiAggregateRef.set({
      date: dateStr,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalResponseTime,
      totalTokens,
      featureUsage,
      hourlyDistribution,
      updatedAt: Timestamp.now()
    });

    logger.debug(`Aggregated AI analytics for ${tenantId} on ${dateStr}: ${totalRequests} requests`);
  }

  /**
   * Run weekly cleanup to remove old detailed logs
   */
  private async runWeeklyCleanup() {
    try {
      const startTime = Date.now();
      const retentionDays = 90; // Keep detailed logs for 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      logger.info(`Cleaning up AI request logs older than ${cutoffDate.toISOString()}...`);

      // Get all tenants
      const tenantsSnapshot = await db.collection('tenants').get();
      const tenants = tenantsSnapshot.docs.map(doc => doc.id);

      let deletedCount = 0;
      let errorCount = 0;

      for (const tenantId of tenants) {
        try {
          const deleted = await this.cleanupTenantAIRequests(tenantId, cutoffTimestamp);
          deletedCount += deleted;
        } catch (error: any) {
          logger.error(`Failed to cleanup AI requests for tenant ${tenantId}:`, error);
          errorCount++;
        }
      }

      // Also cleanup cache
      aiAnalyticsService.cleanupCache();

      const duration = Date.now() - startTime;
      logger.info(`✅ Weekly cleanup completed: ${deletedCount} records deleted, ${errorCount} errors in ${duration}ms`);
    } catch (error: any) {
      logger.error('Weekly cleanup failed:', error);
    }
  }

  /**
   * Cleanup old AI requests for a tenant
   */
  private async cleanupTenantAIRequests(tenantId: string, cutoffTimestamp: Timestamp): Promise<number> {
    const tenantPath = `tenants/${tenantId}`;
    const batchSize = 500;
    let totalDeleted = 0;

    while (true) {
      const snapshot = await db.collection(`${tenantPath}/ai_requests`)
        .where('timestamp', '<', cutoffTimestamp)
        .limit(batchSize)
        .get();

      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += snapshot.size;

      logger.debug(`Deleted ${snapshot.size} old AI requests for tenant ${tenantId}`);

      // Prevent overwhelming the database
      if (snapshot.size < batchSize) {
        break;
      }
    }

    return totalDeleted;
  }

  /**
   * Manually trigger aggregation (for testing or manual runs)
   */
  async manualAggregation(dateStr?: string) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    logger.info(`Running manual aggregation for ${targetDate}...`);
    await this.runDailyAggregation();
    logger.info('Manual aggregation completed');
  }

  /**
   * Stop all jobs
   */
  stop() {
    if (this.dailyAggregationJob) {
      this.dailyAggregationJob.stop();
      logger.info('Daily aggregation job stopped');
    }
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      logger.info('Cleanup job stopped');
    }
  }
}

export const analyticsAggregator = new AnalyticsAggregator();
export default analyticsAggregator;
