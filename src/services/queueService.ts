import { Queue } from 'bullmq';
import { Campaign } from '../types/contracts.js';
import logger from '../utils/logger.js';
import { Redis } from 'ioredis';

// Redis connection options
const redisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Required for BullMQ
};

/**
 * QueueService
 * Manages BullMQ queues for the application
 */
class QueueService {
    private campaignQueue: any;
    private isAvailable: boolean = false;

    constructor() {
        this.initializeQueue();
    }

    private initializeQueue() {
        try {
            this.campaignQueue = new Queue('campaigns', {
                connection: redisOptions,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            });

            // BullMQ doesn't immediately check connection on Queue creation, 
            // but we can listen for errors on the internal client
            this.campaignQueue.on('error', (err: Error) => {
                if (this.isAvailable) {
                    logger.error('Queue Error:', err);
                }
                this.isAvailable = false;
            });

            this.isAvailable = true;
            logger.info('QueueService initialized: campaigns');
        } catch (error) {
            logger.warn('⚠️ QueueService could not initialize (Redis might be down). Bulk features will be disabled.');
            this.isAvailable = false;
        }
    }

    /**
     * Add a campaign to the processing queue
     */
    async addCampaignJob(tenantId: string, campaign: Campaign, options: any = {}): Promise<void> {
        if (!this.isAvailable) {
            logger.warn(`Queue unavailable. Cannot process campaign ${campaign.id} via BullMQ.`);
            // Fallback: simple log or error for now
            throw new Error('Bulk messaging queue is currently unavailable (Redis connection required).');
        }

        try {
            await this.campaignQueue.add(
                'process-campaign',
                { tenantId, campaign },
                {
                    jobId: `camp_${campaign.id}`, // Deduplication
                    ...options
                }
            );
            logger.info(`Added campaign to queue: ${campaign.id} (Tenant: ${tenantId})`);
        } catch (error) {
            logger.error(`Failed to add campaign to queue: ${campaign.id}`, error);
            throw error;
        }
    }

    /**
     * Gracefully close queues
     */
    async close(): Promise<void> {
        if (this.campaignQueue) {
            await this.campaignQueue.close();
        }
    }
    
    public getAvailability(): boolean {
        return this.isAvailable;
    }
}

export const queueService = new QueueService();
