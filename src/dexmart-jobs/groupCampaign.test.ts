import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getCampaignWorker } from './campaignWorker.js';
import { firebaseService } from '../services/FirebaseService.js';
import { channelManager } from '../services/channels/ChannelManager.js';
import { groupService } from '../services/groupService.js';

// Hoist mocks
const { mockFirebase, mockChannelManager, mockGroupService } = vi.hoisted(() => ({
  mockFirebase: {
    getDoc: vi.fn(),
    getCollection: vi.fn(),
    setDoc: vi.fn(),
  },
  mockChannelManager: {
    getAdapter: vi.fn(),
    getRegisteredChannelKeys: vi.fn(),
  },
  mockGroupService: {
    syncGroup: vi.fn(),
    syncAllGroups: vi.fn(),
  }
}));

// Mock dependencies
vi.mock('../services/FirebaseService.js', () => ({
  firebaseService: mockFirebase,
  FirebaseService: { getInstance: () => mockFirebase }
}));

vi.mock('../services/channels/ChannelManager.js', () => ({
  channelManager: mockChannelManager
}));

vi.mock('../services/groupService.js', () => ({
  groupService: mockGroupService
}));

vi.mock('../services/templateService.js', () => ({
  TemplateService: { getInstance: () => ({ getTemplate: vi.fn().mockResolvedValue({ success: true, data: { content: 'Hi' } }) }) }
}));

vi.mock('bullmq', () => {
  return {
    Worker: vi.fn().mockImplementation(function() {
      return {
        on: vi.fn(),
        queue: { add: vi.fn() }
      };
    }),
    Job: vi.fn()
  };
});

describe('CampaignWorker group targeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should target specific groups and trigger sync if missing', async () => {
    const tenantId = 'tenant_1';
    const campaign = {
      id: 'camp_1',
      templateId: 'tpl_1',
      audience: { type: 'groups', targetId: 'group_123' },
      distribution: { type: 'pool' },
      antiBan: { minDelay: 0, maxDelay: 0, aiSpinning: false, batchSize: 0 },
      stats: { sent: 0, failed: 0 }
    };

    // First call: group not found in Firestore
    mockFirebase.getDoc.mockResolvedValueOnce(campaign); // processCampaign start
    mockFirebase.getDoc.mockResolvedValueOnce(null); // loadTargets check for group_123
    
    // Second call: group found after sync
    mockFirebase.getDoc.mockResolvedValueOnce({ id: 'group_123', subject: 'Test Group' });

    mockChannelManager.getRegisteredChannelKeys.mockReturnValue(['chan_1']);
    const mockAdapter = { 
        socket: {}, 
        sendMessage: vi.fn().mockResolvedValue(undefined) 
    };
    mockChannelManager.getAdapter.mockReturnValue(mockAdapter);

    const worker = getCampaignWorker() as any;
    await worker.processCampaign({ data: { tenantId, campaign } } as any);

    // Verify sync was called
    expect(mockGroupService.syncGroup).toHaveBeenCalledWith(mockAdapter.socket, 'group_123');
    // Verify message sent to group JID
    expect(mockAdapter.sendMessage).toHaveBeenCalledWith('group_123', expect.anything());
  });
});
