import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Define hoisted mocks
const { mockChannelService } = vi.hoisted(() => ({
  mockChannelService: {
    stopChannel: vi.fn(),
    deleteChannel: vi.fn(),
    getChannel: vi.fn(),
    getChannelsForAgent: vi.fn(),
  }
}));

vi.mock('../services/ChannelService.js', () => ({
  channelService: mockChannelService,
  default: mockChannelService,
}));

vi.mock('../services/multiTenantService.js', () => ({
    default: {
        getTenant: vi.fn(),
    }
}));

vi.mock('../services/AgentService.js', () => ({
    default: {
        ensureSystemAgent: vi.fn(),
    }
}));

// Now import things that use the mocks
import router from './multiTenant.js';
import { channelService } from '../services/ChannelService.js';

// Setup app
const app = express();
app.use(express.json());
// Mock user for auth middleware
app.use((req: any, res, next) => {
  req.user = { tenantId: 'tenant-123' };
  next();
});
app.use('/', router);

describe('Channel Lifecycle Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /agents/:agentId/channels/:id/disconnect', () => {
    it('should call stopChannel with correct parameters', async () => {
      vi.mocked(channelService.stopChannel).mockResolvedValue({ success: true, data: undefined });

      const res = await request(app)
        .post('/agents/agent-456/channels/chan-789/disconnect')
        .send();

      expect(res.status).toBe(200);
      expect(channelService.stopChannel).toHaveBeenCalledWith('chan-789', 'tenant-123', 'agent-456');
    });
  });

  describe('DELETE /agents/:agentId/channels/:id', () => {
    it('should call deleteChannel with correct parameters', async () => {
      vi.mocked(channelService.deleteChannel).mockResolvedValue({ success: true, data: undefined });

      const res = await request(app)
        .delete('/agents/agent-456/channels/chan-789')
        .query({ archive: 'true' });

      expect(res.status).toBe(200);
      expect(channelService.deleteChannel).toHaveBeenCalledWith('tenant-123', 'chan-789', 'agent-456', { archive: true });
    });
  });
});
