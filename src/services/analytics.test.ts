import { describe, it, expect, vi, beforeEach } from 'vitest';
import analyticsService from './analytics.js';
import { firebaseService } from './FirebaseService.js';
import { admin } from '../lib/firebase.js';

vi.mock('./FirebaseService.js', () => ({
  firebaseService: {
    setDoc: vi.fn().mockResolvedValue(undefined),
    getCollection: vi.fn().mockResolvedValue([
        { date: '2026-02-09', sent: 10, received: 5, errors: 1 }
    ]),
  }
}));

vi.mock('../lib/firebase.js', () => ({
  db: {
    doc: vi.fn(() => ({
      update: vi.fn().mockResolvedValue(undefined)
    })),
    collection: vi.fn(() => ({
      add: vi.fn().mockResolvedValue({ id: 'event_1' }),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      count: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
          data: () => ({ count: 5 }),
          docs: []
      }),
    })),
  },
  admin: {
    firestore: {
      FieldValue: {
        increment: vi.fn((val) => `increment_${val}`),
        serverTimestamp: vi.fn(() => 'mock-timestamp')
      }
    }
  }
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('AnalyticsService', () => {
  const tenantId = 'tenant_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track a sent message correctly', async () => {
    const result = await analyticsService.trackMessage(tenantId, 'sent');

    expect(result.success).toBe(true);
    expect(firebaseService.setDoc).toHaveBeenCalledWith(
      'analytics',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.objectContaining({
        sent: 'increment_1'
      }),
      tenantId,
      true
    );
  });

  it('should track an error correctly', async () => {
      const result = await analyticsService.trackMessage(tenantId, 'error');

      expect(result.success).toBe(true);
      expect(firebaseService.setDoc).toHaveBeenCalledWith(
        'analytics',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.objectContaining({
          errors: 'increment_1'
        }),
        tenantId,
        true
      );
    });

  it('should get historical metrics', async () => {
    const result = await analyticsService.getHistoricalMetrics(tenantId, 7);

    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].date).toBe('2026-02-09');
    }
  });

  it('should track events with tenant isolation', async () => {
      const { db } = await import('../lib/firebase.js');
      const result = await analyticsService.trackEvent(tenantId, 'user_1', 'click_button', { btn: 'save' });

      expect(result.success).toBe(true);
      expect(db.collection).toHaveBeenCalledWith(`tenants/${tenantId}/events`);
  });
});
