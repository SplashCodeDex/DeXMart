import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import router from './omnichannelRoutes.js';
import { channelManager } from '../services/channels/ChannelManager.js';

// Mock dependencies
vi.mock('../services/channels/ChannelManager.js', () => ({
  channelManager: {
    getAdapter: vi.fn(),
  },
}));

// Setup app
const app = express();
app.use(express.json());
// Mock user for auth middleware
app.use((req: any, res, next) => {
  req.user = { tenantId: 'tenant-123' };
  next();
});
app.use('/', router);

describe('Omnichannel Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /send', () => {
    it('should send a message via the active channel adapter', async () => {
      const mockAdapter = {
        sendMessage: vi.fn().mockResolvedValue(undefined)
      };
      (channelManager.getAdapter as any).mockReturnValue(mockAdapter);

      const res = await request(app)
        .post('/send')
        .send({
          channelId: 'chan-456',
          to: '1234567890',
          text: 'Hello via adapter'
        });

      expect(res.status).toBe(200);
      expect(channelManager.getAdapter).toHaveBeenCalledWith('chan-456');
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith('1234567890', expect.objectContaining({ text: 'Hello via adapter' }));
    });

    it('should return 400 if channel is not active', async () => {
      (channelManager.getAdapter as any).mockReturnValue(null);

      const res = await request(app)
        .post('/send')
        .send({
          channelId: 'inactive',
          to: '1234567890',
          text: 'hi'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Channel not active');
    });
  });

  describe('GET /gateway/health', () => {
    it('should return gateway health status', async () => {
      const { OpenClawGateway } = await import('../services/openClawGateway.js');
      vi.spyOn(OpenClawGateway, 'getInstance').mockReturnValue({
        getHealth: vi.fn().mockResolvedValue({ status: 'healthy', version: '1.0.0' })
      } as any);

      const res = await request(app).get('/gateway/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ status: 'healthy', version: '1.0.0' });
    });
  });

  describe('GET /status', () => {
    it('should return gateway status', async () => {
      const { OpenClawGateway } = await import('../services/openClawGateway.js');
      vi.spyOn(OpenClawGateway, 'getInstance').mockReturnValue({
        isInitialized: vi.fn().mockReturnValue(true)
      } as any);

      const res = await request(app).get('/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gatewayInitialized).toBe(true);
    });
  });
});
