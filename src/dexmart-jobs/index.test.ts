import { describe, it, expect, vi, beforeEach } from 'vitest';
import JobRegistry from './index.js';

// Mock dependencies
const mockJobQueueService = {
  process: vi.fn(),
};

vi.mock('../services/jobQueue.js', () => {
  return {
    JobQueueService: vi.fn().mockImplementation(function() {
      return mockJobQueueService;
    }),
    jobQueueService: mockJobQueueService,
  };
});

vi.mock('./aiProcessor.js', () => {
  return {
    default: vi.fn().mockImplementation(function() {
      return {
        processContentGeneration: vi.fn(),
        processBatchAnalysis: vi.fn(),
        processContentModeration: vi.fn(),
        processFineTuningData: vi.fn(),
        processPerformanceAnalytics: vi.fn(),
      };
    })
  };
});

vi.mock('./mediaProcessor.js', () => {
  return {
    default: vi.fn().mockImplementation(function() {
      return {
        processImageOptimization: vi.fn(),
        processBatchImageProcessing: vi.fn(),
        videoThumbnail: vi.fn(),
        fileConversion: vi.fn(),
        processMediaCleanup: vi.fn(),
        processMediaAnalytics: vi.fn(),
      };
    })
  };
});

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('JobRegistry', () => {
  let jobRegistry: JobRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    jobRegistry = new JobRegistry();
  });

  it('should initialize and register all processors', async () => {
    await jobRegistry.initialize(mockJobQueueService as any);

    // Expect AI processors to be registered
    expect(mockJobQueueService.process).toHaveBeenCalledWith('ai-processing', expect.any(Function));
    
    // Expect Media processors to be registered
    expect(mockJobQueueService.process).toHaveBeenCalledWith('media-processing', expect.any(Function));
  });
});
