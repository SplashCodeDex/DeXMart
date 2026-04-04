import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import router from './multiTenant.js';
import { channelService } from '../services/ChannelService.js';
import { channelManager } from '../services/channels/ChannelManager.js';
import agentService from '../services/AgentService.js';
import multiTenantService from '../services/multiTenantService.js';

// Mock dependencies
const { mockChannelService } = vi.hoisted(() => ({
  mockChannelService: {
    getChannelsForAgent: vi.fn(),
    getAllChannelsAcrossAgents: vi.fn(),
    getChannel: vi.fn(),
    createChannel: vi.fn(),
    deleteChannel: vi.fn(),
    updateChannel: vi.fn(),
    startChannel: vi.fn(),
    stopChannel: vi.fn(),
    getChannelQR: vi.fn(),
    getChannelStat: vi.fn(),
    incrementChannelStat: vi.fn(),
    requestPairingCode: vi.fn(),
  }
}));

vi.mock('../services/ChannelService.js', () => ({
  channelService: mockChannelService,
  default: mockChannelService,
}));

vi.mock('../services/AgentService.js', () => ({
  default: {
    getAllAgents: vi.fn(),
    createAgent: vi.fn(),
    deleteAgent: vi.fn(),
    getAgent: vi.fn(),
  }
}));

vi.mock('../services/multiTenantService.js', () => ({
  default: {
    getTenant: vi.fn(),
    initializeTenant: vi.fn(),
    createTenant: vi.fn(),
    updateTenant: vi.fn(),
    canAddBot: vi.fn(),
    listTenants: vi.fn(),
  }
}));

vi.mock('../services/channels/ChannelManager.js', () => ({
  channelManager: {
    getAdapter: vi.fn(),
    getRegisteredChannelKeys: vi.fn(),
  },
}));

// Setup app
const app = express();
app.use(express.json());
app.use((req: any, res, next) => {
  req.user = { tenantId: 'tenant-123' };
  next();
});
app.use('/', router);

describe('Multi-tenant Hierarchy Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /agents/:agentId/channels should list channels for an agent', async () => {
    const mockChannels = [{ id: 'chan-1', name: 'WhatsApp', type: 'whatsapp', status: 'connected' }];
    (channelService.getChannelsForAgent as any).mockResolvedValue({ success: true, data: mockChannels });

    const res = await request(app).get('/agents/agent-456/channels');

    expect(res.status).toBe(200);
    expect(channelService.getChannelsForAgent).toHaveBeenCalledWith('tenant-123', 'agent-456');
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /channels/all should list all channels for a tenant', async () => {
    const mockChannels = [{ id: 'chan-1', name: 'C1', type: 'whatsapp', status: 'connected' }];
    (channelService.getAllChannelsAcrossAgents as any).mockResolvedValue({ success: true, data: mockChannels });

    const res = await request(app).get('/channels/all');

    expect(res.status).toBe(200);
    expect(channelService.getAllChannelsAcrossAgents).toHaveBeenCalledWith('tenant-123');
  });
});
