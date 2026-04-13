import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCampaignWorker } from './campaignWorker.js';
import { firebaseService } from '../services/FirebaseService.js';
import { groupService } from '../services/groupService.js';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockFirebase, mockJobQueue, mockChannelService, mockGroupService, mockSocket } = vi.hoisted(() => {
  const mockSocket = { ev: { emit: vi.fn() } };
  return {
    mockFirebase: {
      getDoc: vi.fn(),
      getCollection: vi.fn(),
      setDoc: vi.fn(),
    },
    mockJobQueue: {
      addJob: vi.fn().mockResolvedValue(undefined),
    },
    mockChannelService: {
      getActiveChannelIds: vi.fn().mockReturnValue([{ id: 'chan_1', isActive: true }]),
    },
    mockGroupService: {
      syncGroup: vi.fn().mockResolvedValue(undefined),
      syncAllGroups: vi.fn().mockResolvedValue(undefined),
    },
    mockSocket,
  };
});

// Mock dependencies
vi.mock('../services/FirebaseService.js', () => ({
  firebaseService: mockFirebase,
  FirebaseService: { getInstance: () => mockFirebase },
}));

vi.mock('../services/jobQueue.js', () => ({
  default: mockJobQueue,
}));

vi.mock('../services/ChannelService.js', () => ({
  channelService: mockChannelService,
}));

vi.mock('../services/groupService.js', () => ({
  groupService: mockGroupService,
}));

vi.mock('../services/templateService.js', () => ({
  TemplateService: {
    getInstance: () => ({
      getTemplate: vi.fn().mockResolvedValue({ success: true, data: { content: 'Hi' } }),
    }),
  },
}));

vi.mock('../services/antiBanService.js', () => ({
  antiBanService: {
    checkContentHash: vi.fn().mockResolvedValue(false),
    triggerCooldown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/webhookService.js', () => ({
  webhookService: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../services/socketService.js', () => ({
  socketService: { emitProgress: vi.fn() },
}));

vi.mock('../services/ai-utility.js', () => ({
  AIUtilityService: { spinMessage: vi.fn() },
}));

vi.mock('../utils/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../dexmart-config/ConfigManager.js', () => ({
  default: {
    config: {
      redis: { host: 'localhost', port: 6379, password: undefined },
    },
  },
}));

vi.mock('../../extensions/whatsapp/src/runtime.js', () => ({
  getWhatsAppRuntime: vi.fn().mockReturnValue({
    channel: {
      whatsapp: {
        getActiveWebListener: vi.fn().mockReturnValue(mockSocket),
      },
    },
  }),
}));

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(function () {
    return { on: vi.fn(), queue: { add: vi.fn() } };
  }),
  Job: vi.fn(),
}));

describe('CampaignWorker group targeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobQueue.addJob.mockResolvedValue(undefined);
    mockChannelService.getActiveChannelIds.mockReturnValue([{ id: 'chan_1', isActive: true }]);
    mockGroupService.syncGroup.mockResolvedValue(undefined);
  });

  it('should target specific groups and trigger sync if missing', async () => {
    const tenantId = 'tenant_1';
    const campaign = {
      id: 'camp_1',
      templateId: 'tpl_1',
      audience: { type: 'groups', targetId: 'group_123' },
      distribution: { type: 'pool' },
      antiBan: { minDelay: 0, maxDelay: 0, aiSpinning: false, batchSize: 0 },
      stats: { sent: 0, failed: 0 },
    };

    // First call: campaign record
    mockFirebase.getDoc.mockResolvedValueOnce(campaign);
    // Second call: group not found in Firestore
    mockFirebase.getDoc.mockResolvedValueOnce(null);
    // Third call: group found after sync
    mockFirebase.getDoc.mockResolvedValueOnce({ id: 'group_123', subject: 'Test Group' });
    mockFirebase.setDoc.mockResolvedValue(undefined);

    const worker = getCampaignWorker() as any;
    await worker.processCampaign({ data: { tenantId, campaign } } as any);

    // Verify native runtime was used for group sync
    expect(mockGroupService.syncGroup).toHaveBeenCalledWith(mockSocket, 'group_123');

    // Verify message enqueued to job queue (not sent directly)
    expect(mockJobQueue.addJob).toHaveBeenCalledWith(
      'whatsapp-outbound',
      'campaign-send',
      expect.objectContaining({ tenantId, jid: 'group_123' }),
    );
  });
});
