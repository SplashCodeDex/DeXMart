import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firebaseService } from './FirebaseService.js';
import { db } from '@/lib/firebase.js';

// Mock dependencies
vi.mock('@/lib/firebase.js', () => ({
  db: {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ 
      exists: false, 
      data: () => ({}),
      docs: [] 
    })
  },
  admin: {
    auth: vi.fn()
  }
}));

vi.mock('@/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    security: vi.fn()
  }
}));

describe('FirebaseService Hierarchy', () => {
  const tenantId = 'tenant-123';
  const agentId = 'agent-456';
  const channelId = 'chan-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve nested channel collection path: tenants/T/agents/A/channels', async () => {
    // This should fail until we implement the new path logic
    const nestedCollection = `agents/${agentId}/channels`;
    
    await firebaseService.getCollection(nestedCollection, tenantId);

    expect(db.collection).toHaveBeenCalledWith(`tenants/${tenantId}/agents/${agentId}/channels`);
  });

  it('should resolve nested channel auth path: tenants/T/agents/A/channels/C/auth', async () => {
    const nestedAuth = `agents/${agentId}/channels/${channelId}/auth`;
    
    await firebaseService.getDoc(nestedAuth, 'creds', tenantId);

    expect(db.collection).toHaveBeenCalledWith(`tenants/${tenantId}/agents/${agentId}/channels/${channelId}/auth`);
  });
});
