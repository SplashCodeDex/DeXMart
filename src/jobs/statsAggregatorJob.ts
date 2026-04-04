import { Worker, Job } from 'bullmq';
import { db } from '../lib/firebase.js';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import logger from '../utils/logger.js';
import { multiTenantService } from '../services/multiTenantService.js';
import configManager from '../config/ConfigManager.js';

const redisOptions = {
    host: configManager.config.redis.host,
    port: configManager.config.redis.port,
    password: configManager.config.redis.password,
    maxRetriesPerRequest: null,
};

/**
 * StatsAggregatorJob
 *
 * Background job that rolls up raw message metrics into daily/monthly records
 * for high-performance dashboard charts.
 */
class StatsAggregatorJob {
    private worker: any;

    constructor() {
        this.worker = new Worker(
            'analytics',
            async (job: Job) => {
                if (job.name === 'aggregate-stats') {
                    await this.performAggregation();
                }
            },
            { connection: redisOptions, concurrency: 1 }
        );

        this.worker.on('completed', (job: Job) => {
            logger.info(`StatsAggregatorJob ${job.id} completed`);
        });

        this.worker.on('failed', (job: Job | undefined, err: Error) => {
            logger.error(`StatsAggregatorJob ${job?.id} failed:`, err);
        });

        logger.info('StatsAggregatorJob initialized');
    }

    private async performAggregation(): Promise<void> {
        logger.info('Starting stats aggregation for all active tenants...');

        try {
            const tenants = await multiTenantService.listTenants();
            const today = new Date().toISOString().split('T')[0];

            for (const tenant of tenants) {
                if (tenant.status !== 'active') continue;

                try {
                    await this.aggregateTenantStats(tenant.id, today);
                } catch (tenantError) {
                    logger.error(`Failed to aggregate stats for tenant ${tenant.id}:`, tenantError);
                }
            }

            logger.info('Stats aggregation completed for all tenants.');
        } catch (error) {
            logger.error('Global stats aggregation error:', error);
            throw error;
        }
    }

    private async aggregateTenantStats(tenantId: string, date: string): Promise<void> {
        // In a real high-volume scenario, we'd query the 'messages' collection
        // for the specific date and count them.
        // For Phase 2, we roll up the 'analytics' daily doc into a permanent 'stats_daily' record
        // or ensure the existing 'analytics' doc is consistent.

        const analyticsRef = db.doc(`tenants/${tenantId}/analytics/${date}`);
        const snapshot = await analyticsRef.get();

        if (!snapshot.exists) {
            logger.debug(`No analytics found for tenant ${tenantId} on ${date}`);
            return;
        }

        const data = snapshot.data() || {};

        // Finalize the daily record
        await db.doc(`tenants/${tenantId}/stats_daily/${date}`).set({
            ...data,
            aggregatedAt: Timestamp.now(),
            tenantId
        }, { merge: true });

        logger.info(`Aggregated daily stats for ${tenantId} on ${date}`);
    }

    private static instance: StatsAggregatorJob;

    public static getInstance() {
        if (!StatsAggregatorJob.instance) {
            StatsAggregatorJob.instance = new StatsAggregatorJob();
        }
        return StatsAggregatorJob.instance;
    }
}

export const getStatsAggregatorJob = () => {
    return StatsAggregatorJob.getInstance();
};
