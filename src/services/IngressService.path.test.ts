import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IngressService } from './IngressService.js';
import { agentService } from './AgentService.js';
import { tenantConfigService } from './tenantConfigService.js';
import { webhookService } from './webhookService.js';

// Mock dependencies
vi.mock('./AgentService.js', () => ({
  agentService: {
    getAgent: vi.fn()
  }
}));

vi.mock('./tenantConfigService.js', () => ({
  tenantConfigService: {
    isFeatureEnabled: vi.fn()
  }
}));

vi.mock('./webhookService.js', () => ({
  webhookService: {
    dispatch: vi.fn()
  }
}));

vi.mock('../utils/createChannelContext.js', () => ({
  createChannelContext: vi.fn(() => Promise.resolve({ sender: { jid: '123@s.whatsapp.net' } }))
}));

describe('IngressService Path-Aware Resolution', () => {
  let service: IngressService;
  const tenantId = 'tenant-123';
  const channelId = 'chan-1';
  const agentId = 'agent-456';
  const fullPath = `tenants/${tenantId}/agents/${agentId}/channels/${channelId}`;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - reset instance
    IngressService.instance = undefined;
    service = IngressService.getInstance();
  });

  describe('handleCommonMessage', () => {
    it('should resolve agentId from fullPath and route to AI', async () => {
      const mockAgent = { id: agentId, name: 'AI Agent' };
      const mockContext = {
        unifiedAI: {
          processMessage: vi.fn()
        }
      };
      const mockMessage = { platform: 'whatsapp', content: { text: 'hello' } } as any;

      vi.mocked(agentService.getAgent).mockResolvedValue({ success: true, data: mockAgent as any });
      vi.mocked(tenantConfigService.isFeatureEnabled).mockResolvedValue(true);

      await service.handleCommonMessage(tenantId, channelId, mockMessage, mockContext as any, fullPath);

      // Verify correct agent was fetched
      expect(agentService.getAgent).toHaveBeenCalledWith(tenantId, agentId);
      
      // Verify AI processing was called
      expect(mockContext.unifiedAI.processMessage).toHaveBeenCalled();
      expect(webhookService.dispatch).not.toHaveBeenCalled();
    });

    it('should fallback to webhook if no agent in path (system_default)', async () => {
        const mockContext = { 
            unifiedAI: {
                processMessage: vi.fn()
            } 
        };
        const mockMessage = { platform: 'whatsapp', content: { text: 'hello' } } as any;
        const systemPath = `tenants/${tenantId}/agents/system_default/channels/${channelId}`;

        // Mock agentService.getAgent to return system_default agent
        const mockSystemAgent = { id: 'system_default', name: 'System Default' };
        vi.mocked(agentService.getAgent).mockResolvedValue({ success: true, data: mockSystemAgent as any });
        vi.mocked(tenantConfigService.isFeatureEnabled).mockResolvedValue(true);

        await service.handleCommonMessage(tenantId, channelId, mockMessage, mockContext as any, systemPath);

        // Should NOT call AI if agent is system_default
        expect(mockContext.unifiedAI.processMessage).not.toHaveBeenCalled();
        expect(webhookService.dispatch).toHaveBeenCalledWith(tenantId, 'message.received', expect.any(Object));
    });
  });
});
