import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowService } from './flowService.js';
import { db } from '../lib/firebase.js';

vi.mock('../lib/firebase.js', () => ({
  db: {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FlowService', () => {
  let service: FlowService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = FlowService.getInstance();
  });

  it('should save a flow and return success', async () => {
    const tenantId = 'tenant-123';
    const flowData = {
      name: 'Test Flow',
      nodes: [{ id: '1', type: 'trigger' }],
      edges: []
    };

    const result = await service.saveFlow(tenantId, flowData);

    expect(result.success).toBe(true);
    expect(db.collection).toHaveBeenCalledWith('tenants');
    expect(db.doc).toHaveBeenCalledWith(tenantId);
    if (result.success) {
      expect(result.data.name).toBe('Test Flow');
      expect(result.data.id).toBeDefined();
    }
  });

  it('should retrieve a flow by ID', async () => {
    const tenantId = 'tenant-123';
    const flowId = 'flow-456';
    const mockFlow = { id: flowId, name: 'Saved Flow', nodes: [], edges: [] };

    (db.get as any).mockResolvedValue({
      exists: true,
      data: () => mockFlow
    });

    const result = await service.getFlow(tenantId, flowId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Saved Flow');
    }
  });
});
