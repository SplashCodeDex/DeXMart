import { JobQueueService } from '../services/jobQueue.js';
import AIProcessor from './aiProcessor.js';
import MediaProcessor from './mediaProcessor.js';
import { getStatsAggregatorJob } from './statsAggregatorJob.js';
import { initializeWhatsappWorker } from '../workers/whatsappQueueWorker.js';
import { initializeGroupSyncWorker } from '../workers/groupSyncWorker.js';
import { initializeAntiBanResumeWorker } from '../workers/antiBanResumeWorker.js';
import logger from '../utils/logger.js';
import { Job } from 'bullmq';

interface ProcessorResult {
  success: boolean;
  processingTime?: number;
  [key: string]: any;
}

class JobRegistry {
  private jobQueue: JobQueueService | null;
  private processors: {
    ai: AIProcessor;
    media: MediaProcessor;
  };

  constructor() {
    this.jobQueue = null;
    this.processors = {
      ai: new AIProcessor(),
      media: new MediaProcessor(),
    };
  }

  async initialize(jobQueueService: JobQueueService) {
    this.jobQueue = jobQueueService;

    try {
      logger.info('Registering job processors...');

      // Register AI Processor
      this.jobQueue.process('ai-processing', async (job: Job) => {
        const jobName = (job.data as any).jobName || job.name;
        logger.debug(`Routing AI job: ${jobName}`, { jobId: job.id });

        switch (jobName) {
          case 'content-generation':
            return await this.processors.ai.processContentGeneration(job.data, job);
          case 'batch-analysis':
            return await this.processors.ai.processBatchAnalysis(job.data, job);
          case 'content-moderation':
            return await this.processors.ai.processContentModeration(job.data, job);
          case 'fine-tuning':
            return await this.processors.ai.processFineTuningData(job.data, job);
          case 'performance-analytics':
            return await this.processors.ai.processPerformanceAnalytics(job.data, job);
          default:
            logger.warn(`Unknown AI job name: ${jobName}`);
            throw new Error(`Unknown AI job name: ${jobName}`);
        }
      });

      // Register Media Processor
      this.jobQueue.process('media-processing', async (job: Job) => {
        const jobName = (job.data as any).jobName || job.name;
        logger.debug(`Routing Media job: ${jobName}`, { jobId: job.id });

        switch (jobName) {
          case 'image-optimization':
            return await this.processors.media.processImageOptimization(job.data, job);
          case 'batch-image-processing':
            return await this.processors.media.processBatchImageProcessing(job.data, job);
          case 'video-thumbnail':
            return await this.processors.media.processVideoThumbnail(job.data, job);
          case 'file-conversion':
            return await this.processors.media.processFileConversion(job.data, job);
          case 'media-cleanup':
            return await this.processors.media.processMediaCleanup(job.data, job);
          case 'media-analytics':
            return await this.processors.media.processMediaAnalytics(job.data, job);
          default:
            logger.warn(`Unknown Media job name: ${jobName}`);
            throw new Error(`Unknown Media job name: ${jobName}`);
        }
      });

      // Initialize BullMQ Workers
      getStatsAggregatorJob();
      initializeWhatsappWorker();
      initializeGroupSyncWorker();
      initializeAntiBanResumeWorker(); // 60s default interval

      logger.info('All job processors registered successfully');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to register job processors', { error: err.message });
      throw err;
    }
  }
}

export default JobRegistry;
