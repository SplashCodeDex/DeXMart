import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStatsAggregatorJob } from './statsAggregatorJob.js';
import { db } from '../lib/firebase.js';

// Mock bullmq
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(function() {
    return {
      on: vi.fn(),
    };
  }),
}));

// Mock firebase
vi.mock('../lib/firebase.js', () => ({
  db: {
    doc: vi.fn().mockReturnThis(),
    get: vi.fn(),
    set: vi.fn(),
  }
}));

vi.mock('../services/multiTenantService.js', () => ({
  multiTenantService: {
    listTenants: vi.fn().mockResolvedValue([
      { id: 'tenant-1', status: 'active' },
      { id: 'tenant-2', status: 'inactive' }
    ]),
  }
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('StatsAggregatorJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize correctly', () => {
    const job = getStatsAggregatorJob();
    expect(job).toBeDefined();
  });

  it('should perform aggregation for active tenants', async () => {
    const job = getStatsAggregatorJob();
    
    // Mock analytics data
    const mockDoc = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ sent: 10, received: 5 })
      }),
      set: vi.fn().mockResolvedValue(true)
    };
    (db.doc as any).mockReturnValue(mockDoc);

    // We trigger the private method via 'any' for testing purposes
    await (job as any).performAggregation();

    expect(db.doc).toHaveBeenCalledWith(expect.stringContaining('tenants/tenant-1/analytics/'));
    expect(db.doc).toHaveBeenCalledWith(expect.stringContaining('tenants/tenant-1/stats_daily/'));
    // Should skip inactive tenant-2
    expect(db.doc).not.toHaveBeenCalledWith(expect.stringContaining('tenants/tenant-2/'));
  });
});
