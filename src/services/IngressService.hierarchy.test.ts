import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IngressService } from './IngressService.js';
import { agentService } from './AgentService.js';
import { webhookService } from './webhookService.js';
import { tenantConfigService } from './tenantConfigService.js';

// Mock dependencies
vi.mock('./AgentService.js', () => ({
  agentService: {
    getAgent: vi.fn()
  }
}));

vi.mock('./webhookService.js', () => ({
  webhookService: {
    dispatch: vi.fn()
  }
}));

vi.mock('./tenantConfigService.js', () => ({
  tenantConfigService: {
    isFeatureEnabled: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('../utils/createChannelContext.js', () => ({
  createChannelContext: vi.fn().mockResolvedValue({
    sender: { jid: 'user-123' },
    message: { conversation: 'hello' }
  })
}));

describe('IngressService Hierarchy', () => {
  let service: IngressService;
  const mockContext: any = {
    unifiedAI: {
      processMessage: vi.fn().mockResolvedValue({ success: true })
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = IngressService.getInstance();
  });

  it('should resolve Agent from fullPath and bypass ChannelBindingService', async () => {
    const tenantId = 'tenant-1';
    const agentId = 'agent-1';
    const channelId = 'chan-1';
    const fullPath = `tenants/${tenantId}/agents/${agentId}/channels/${channelId}`;

    vi.mocked(agentService.getAgent).mockResolvedValue({
      success: true,
      data: { id: agentId, name: 'Path Agent' } as any
    });

    // @ts-ignore - testing new parameter
    await service.handleMessage(tenantId, channelId, {} as any, mockContext, fullPath);

    expect(agentService.getAgent).toHaveBeenCalledWith(tenantId, agentId);
    expect(mockContext.unifiedAI.processMessage).toHaveBeenCalled();
  });
});
