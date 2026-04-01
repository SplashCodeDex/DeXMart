import { Queue } from 'bullmq';
import configManager from '../config/ConfigManager.js';
import logger from '../utils/logger.js';

/**
 * Shared Redis connection options for BullMQ
 */
export const redisConnection = {
  host: configManager.config.redis.host,
  port: configManager.config.redis.port,
  password: configManager.config.redis.password,
  maxRetriesPerRequest: null, // Required by BullMQ
};

/**
 * Image Generation Queue
 */
export const imageGenerationQueue = new Queue('image-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: 1000,
  }
});

/**
 * Job Results Queue
 */
export const jobResultsQueue = new Queue('job-results', {
  connection: redisConnection
});

logger.info('BullMQ Queues initialized with unified Redis connection');
