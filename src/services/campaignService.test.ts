import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CampaignService } from './campaignService.js';
import { FirebaseService } from './FirebaseService.js';
import { queueService } from './queueService.js';

// Hoist mocks
const { mockFirebase, mockQueueService } = vi.hoisted(() => ({
  mockFirebase: {
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    getCollection: vi.fn(),
    deleteDoc: vi.fn(),
  },
  mockQueueService: {
    addCampaignJob: vi.fn(),
  }
}));

// Mock dependencies
vi.mock('./FirebaseService.js', () => ({
  firebaseService: mockFirebase,
  FirebaseService: { getInstance: () => mockFirebase }
}));

vi.mock('./queueService.js', () => ({
  queueService: mockQueueService
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('CampaignService', () => {
  let service: CampaignService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = CampaignService.getInstance();
  });

  const tenantId = 'tenant_1';
  const campaignId = 'camp_123';
  const mockCampaign = {
    id: campaignId,
    name: 'Test',
    templateId: 'tpl_1',
    audience: { type: 'contacts', targetId: 'aud_1' },
    distribution: { type: 'single', channelId: 'chan_1' },
    antiBan: { aiSpinning: false, minDelay: 1, maxDelay: 5 },
    schedule: { type: 'immediate' },
    stats: { total: 0, sent: 0, failed: 0, pending: 0 },
    status: 'draft'
  };

  describe('createCampaign', () => {
    it('should create and start immediate campaign', async () => {
      mockFirebase.setDoc.mockResolvedValue(undefined);
      mockFirebase.getDoc.mockResolvedValue(mockCampaign);
      mockQueueService.addCampaignJob.mockResolvedValue(undefined);

      const result = await service.createCampaign(tenantId, mockCampaign as any);

      expect(result.success).toBe(true);
      expect(mockFirebase.setDoc).toHaveBeenCalledWith('campaigns', expect.any(String), expect.anything(), tenantId);
      expect(mockQueueService.addCampaignJob).toHaveBeenCalled();
    });
  });

  describe('startCampaign', () => {
    it('should add job to queue', async () => {
      mockFirebase.getDoc.mockResolvedValue(mockCampaign);
      mockQueueService.addCampaignJob.mockResolvedValue(undefined);

      const result = await service.startCampaign(tenantId, campaignId);

      expect(result.success).toBe(true);
      expect(mockQueueService.addCampaignJob).toHaveBeenCalled();
    });
  });

  describe('pauseCampaign', () => {
    it('should update status to paused', async () => {
      mockFirebase.setDoc.mockResolvedValue(undefined);
      const result = await service.pauseCampaign(tenantId, campaignId);
      expect(result.success).toBe(true);
      expect(mockFirebase.setDoc).toHaveBeenCalledWith('campaigns', campaignId, expect.objectContaining({ status: 'paused' }), tenantId, true);
    });
  });
});
