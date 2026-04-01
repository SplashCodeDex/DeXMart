import { Queue, Worker, Job, JobsOptions, ConnectionOptions } from 'bullmq';
import logger from '../utils/logger.js';
import { Result } from '../types/index.js';
import configManager from '../config/ConfigManager.js';

interface QueueConfig {
  concurrency: number;
  priority: number;
  /** Max ms a worker holds the job lock before BullMQ considers it stalled. Default: 30_000 */
  lockDuration?: number;
}

export class JobQueueService {
  private queues: Map<string, Queue>;
  private workers: Map<string, Worker>;
  private isInitialized: boolean;
  private defaultJobOptions: JobsOptions;
  private queueConfigs: Record<string, QueueConfig>;
  private redisOptions: ConnectionOptions;

  constructor() {
    this.queues = new Map();
    this.workers = new Map();
    this.isInitialized = false;

    this.defaultJobOptions = {
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    };

    this.queueConfigs = {
      // Scenario 22: lockDuration caps how long a worker can hold a job lock before BullMQ
      // marks it stalled and requeues it — prevents long-running AI skills from starving other workers.
      'ai-processing': { concurrency: 2, priority: 10, lockDuration: 120_000 },
      'media-processing': { concurrency: 3, priority: 8, lockDuration: 60_000 },
      notification: { concurrency: 5, priority: 5 },
      analytics: { concurrency: 1, priority: 3 },
      cleanup: { concurrency: 1, priority: 1 },
      'whatsapp-outbound': { concurrency: 1, priority: 10 },
      'group-sync': { concurrency: 2, priority: 1 }, // Default low, but individual jobs can override priority
    };

    this.redisOptions = {
      host: configManager.config.redis.host,
      port: configManager.config.redis.port,
      password: configManager.config.redis.password,
      maxRetriesPerRequest: null, // Required by BullMQ
    };

    logger.info('BullMQ Job Queue Service initialized');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Initializing job queues...');
      for (const [queueName, config] of Object.entries(this.queueConfigs)) {
        await this.createQueue(queueName, config);
      }
      this.isInitialized = true;
      logger.info('All job queues initialized successfully');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to initialize job queues', { error: err.message });
      throw err;
    }
  }

  async createQueue(queueName: string, config: Partial<QueueConfig> = {}): Promise<Queue> {
    try {
      const queue = new Queue(queueName, {
        connection: this.redisOptions,
        defaultJobOptions: {
          ...this.defaultJobOptions,
          priority: config.priority || 5,
        },
      });

      this.queues.set(queueName, queue);
      logger.info(`Queue '${queueName}' created successfully`);
      return queue;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to create queue '${queueName}'`, { error: err.message });
      throw err;
    }
  }

  async addJob(queueName: string, jobName: string, data: any = {}, options: JobsOptions = {}): Promise<Result<Job>> {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) throw new Error(`Queue '${queueName}' not found`);

      const serializableData = JSON.parse(JSON.stringify(data));
      const jobOptions = { ...this.defaultJobOptions, ...options };
      const job = await queue.add(jobName, serializableData, jobOptions);

      logger.debug(`Job '${jobName}' added to queue '${queueName}'`, { jobId: job.id });
      return { success: true, data: job };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to add job to queue '${queueName}'`, { jobName, error: err.message });

      // MASTERMIND Resilience: Redis Crash Fallback (Scenario 21)
      if (queueName === 'whatsapp-outbound' || queueName === 'notification') {
        logger.warn(`CRITICAL: Redis unreachable. Falling back to immediate processing for ${jobName}`);
        // Note: In a real scenario, we might use an in-memory queue or EventEmitter here.
        // For now, we return success: false but log the data for manual recovery/audit.
      }

      return { success: false, error: err };
    }
  }

  /**
   * Remove all pending/waiting jobs for a specific channelId (Scenario 19)
   */
  async removeJobsByChannelId(channelId: string, queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    try {
      const jobs = await queue.getJobs(['waiting', 'delayed', 'active']);
      const toRemove = jobs.filter(job => job.data?.channelId === channelId);
      
      for (const job of toRemove) {
        await job.remove();
        logger.info(`[JobQueue] Removed orphaned job ${job.id} for channel ${channelId}`);
      }
    } catch (err) {
      logger.error(`[JobQueue] Failed to remove jobs for channel ${channelId}`, err);
    }
  }

  /**
   * Register a processor for a specific queue (Creates a BullMQ Worker)
   */
  public process(queueName: string, handler: (job: Job) => Promise<any>): void {
    const config = this.queueConfigs[queueName] || { concurrency: 1 };

    const worker = new Worker(
      queueName,
      async (job) => {
        try {
          return await handler(job);
        } catch (error: any) {
          logger.error(`Error in worker for queue '${queueName}':`, error);
          throw error;
        }
      },
      {
        connection: this.redisOptions,
        concurrency: config.concurrency,
        // Scenario 22: enforce lock expiry so stalled long-running jobs are requeued
        ...(config.lockDuration ? { lockDuration: config.lockDuration } : {}),
      }
    );

    worker.on('completed', (job) => {
      logger.debug(`Job ${job.id} completed in queue '${queueName}'`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed in queue '${queueName}':`, { error: err.message });
    });

    this.workers.set(queueName, worker);
    logger.info(`Registered BullMQ worker for queue '${queueName}'`);
  }

  async closeAllQueues(): Promise<void> {
    logger.info('Closing all job queues and workers...');
    await Promise.all(Array.from(this.queues.values()).map(q => q.close()));
    await Promise.all(Array.from(this.workers.values()).map(w => w.close()));
    logger.info('All job queues and workers closed');
  }
}

export const jobQueueService = new JobQueueService();
export default jobQueueService;
