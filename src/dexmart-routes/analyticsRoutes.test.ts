import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import analyticsRoutes from './analyticsRoutes.js';
import { AnalyticsController } from '../controllers/analyticsController.js';

// Mock dependencies
vi.mock('../middleware/authMiddleware.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { tenantId: 'tenant-123', userId: 'user-123' };
    next();
  },
}));

vi.mock('../controllers/analyticsController.js', () => ({
  AnalyticsController: {
    getDashboardStats: vi.fn((req, res) => res.json({ success: true, data: { totalBots: 5 } })),
    getUsageAnalytics: vi.fn((req, res) => res.json({ success: true, data: [{ date: '2026-02-20', sent: 10 }] })),
    getMessageAnalytics: vi.fn((req, res) => res.json({ success: true, data: [] })),
  }
}));

describe('Analytics Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRoutes);
  });

  it('GET /api/analytics/dashboard should call AnalyticsController.getDashboardStats', async () => {
    const response = await request(app).get('/api/analytics/dashboard');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(AnalyticsController.getDashboardStats).toHaveBeenCalled();
  });

  it('GET /api/analytics/usage should call AnalyticsController.getUsageAnalytics', async () => {
    const response = await request(app).get('/api/analytics/usage');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(AnalyticsController.getUsageAnalytics).toHaveBeenCalled();
  });
});
