import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobQueueService } from './jobQueue.js';
import { Queue, Worker } from 'bullmq';

// Mock bullmq
vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(function() {
      return {
        add: vi.fn(),
        close: vi.fn(),
      };
    }),
    Worker: vi.fn().mockImplementation(function() {
      return {
        on: vi.fn(),
        close: vi.fn(),
      };
    }),
  };
});

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../config/ConfigManager.js', () => ({
  default: {
    config: {
      redis: {
        host: 'localhost',
        port: 6379,
        password: '',
      },
    },
  },
}));

describe('JobQueueService', () => {
  let jobQueueService: JobQueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    jobQueueService = new JobQueueService();
  });

  it('should register a worker for a queue', async () => {
    await jobQueueService.initialize();

    const mockHandler = vi.fn();
    jobQueueService.process('ai-processing', mockHandler);

    expect(Worker).toHaveBeenCalledWith(
      'ai-processing',
      expect.any(Function),
      expect.objectContaining({ concurrency: 2 })
    );
  });

  it('should initialize queues from config', async () => {
    await jobQueueService.initialize();
    expect(Queue).toHaveBeenCalledWith('ai-processing', expect.any(Object));
    expect(Queue).toHaveBeenCalledWith('media-processing', expect.any(Object));
  });
});
