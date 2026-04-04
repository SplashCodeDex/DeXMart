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

describe('IngressService', () => {
  let service: IngressService;
  const tenantId = 'tenant-123';
  const channelId = 'chan-456';
  const fullPath = `tenants/${tenantId}/agents/agent-1/channels/${channelId}`;
  const mockContext: any = {
    unifiedAI: {
      processMessage: vi.fn().mockResolvedValue({ success: true })
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = IngressService.getInstance();
  });

  it('should route to AI Agent when agent is assigned via path', async () => {
    vi.mocked(agentService.getAgent).mockResolvedValue({
      success: true,
      data: { id: 'agent-1', name: 'AI Assistant', memorySearch: true, boundChannels: [], skills: [], createdAt: new Date(), updatedAt: new Date() } as any
    });

    await service.handleMessage(tenantId, channelId, {} as any, mockContext, fullPath);

    expect(agentService.getAgent).toHaveBeenCalledWith(tenantId, 'agent-1');
    expect(mockContext.unifiedAI.processMessage).toHaveBeenCalled();
    expect(webhookService.dispatch).not.toHaveBeenCalledWith(tenantId, 'message.received', expect.anything());
  });

  it('should forward to Webhook when no agent is assigned (system_default)', async () => {
    vi.mocked(agentService.getAgent).mockResolvedValue({
      success: true,
      data: { id: 'system_default', name: 'Default' } as any
    });

    await service.handleMessage(tenantId, channelId, {} as any, mockContext, `tenants/${tenantId}/agents/system_default/channels/${channelId}`);

    expect(mockContext.unifiedAI.processMessage).not.toHaveBeenCalled();
    expect(webhookService.dispatch).toHaveBeenCalledWith(tenantId, 'message.received', expect.objectContaining({
      channelId,
      sender: 'user-123',
      message: 'hello'
    }));
  });

  describe('handleCommonMessage', () => {
    const commonMsg: any = {
      id: 'msg-1',
      platform: 'telegram',
      from: 'user-789',
      to: channelId,
      content: { text: 'hi agent' },
      timestamp: Date.now()
    };

    it('should route common message to AI Agent', async () => {
      vi.mocked(agentService.getAgent).mockResolvedValue({
        success: true,
        data: { id: 'agent-1', name: 'AI Agent' } as any
      });

      await service.handleCommonMessage(tenantId, channelId, commonMsg, mockContext, fullPath);

      expect(mockContext.unifiedAI.processMessage).toHaveBeenCalled();
      expect(webhookService.dispatch).not.toHaveBeenCalled();
    });

    it('should forward common message to webhook if AI disabled', async () => {
      vi.mocked(agentService.getAgent).mockResolvedValue({
        success: true,
        data: { id: 'agent-1', name: 'AI Agent' } as any
      });
      vi.mocked(tenantConfigService.isFeatureEnabled).mockResolvedValue(false);

      await service.handleCommonMessage(tenantId, channelId, commonMsg, mockContext, fullPath);

      expect(mockContext.unifiedAI.processMessage).not.toHaveBeenCalled();
      expect(webhookService.dispatch).toHaveBeenCalledWith(tenantId, 'message.received', commonMsg);
    });
  });
});
