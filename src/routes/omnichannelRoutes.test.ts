import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import router from './omnichannelRoutes.js';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockJobQueue } = vi.hoisted(() => ({
  mockJobQueue: {
    addJob: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/jobQueue.js', () => ({
  default: mockJobQueue,
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
    mockJobQueue.addJob.mockResolvedValue(undefined);
  });

  describe('POST /send', () => {
    it('should enqueue a message via the job queue', async () => {
      const res = await request(app)
        .post('/send')
        .send({
          channelId: 'chan-456',
          to: '1234567890',
          text: 'Hello via adapter',
        });

      expect(res.status).toBe(200);
      expect(mockJobQueue.addJob).toHaveBeenCalledWith(
        'whatsapp-outbound',
        'send',
        expect.objectContaining({
          channelId: 'chan-456',
          jid: '1234567890',
          message: 'Hello via adapter',
        }),
      );
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/send')
        .send({ text: 'Missing channelId and to' });

      expect(res.status).toBe(400);
    });
  });

});

