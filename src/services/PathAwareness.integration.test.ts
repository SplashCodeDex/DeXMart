import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsappAdapter } from './channels/whatsapp/WhatsappAdapter.js';
import { IngressService } from './IngressService.js';
import { agentService } from './AgentService.js';
import AuthSystem from '@/services/authSystem.js';

// Mock dependencies
vi.mock('@/services/authSystem.js', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      connect: vi.fn().mockResolvedValue({ success: true, data: { ev: { on: vi.fn() }, sendMessage: vi.fn() } }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn()
    };
  })
}));

vi.mock('./AgentService.js', () => ({
  agentService: {
    getAgent: vi.fn()
  }
}));

vi.mock('./tenantConfigService.js', () => ({
  tenantConfigService: {
    isFeatureEnabled: vi.fn().mockResolvedValue(true)
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

vi.mock('openclaw', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    setActiveWebListener: vi.fn(),
    sendMessageWhatsApp: vi.fn(),
    sendReactionWhatsApp: vi.fn(),
    sendPollWhatsApp: vi.fn()
  };
});

vi.mock('../utils/createChannelContext.js', () => ({
  createChannelContext: vi.fn().mockResolvedValue({
    sender: { jid: 'user-123' },
    message: { conversation: 'hello path' }
  })
}));

describe('Path-Aware Integration (Adapter -> Ingress)', () => {
  const tenantId = 'tenant-xyz';
  const agentId = 'agent-master';
  const channelId = 'chan-wa-1';
  const fullPath = `tenants/${tenantId}/agents/${agentId}/channels/${channelId}`;

  const mockContext: any = {
    unifiedAI: {
      processMessage: vi.fn().mockResolvedValue({ success: true })
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should flow from WhatsappAdapter message event to IngressService AI processing using fullPath', async () => {
    // 1. Setup Adapter
    const adapter = new WhatsappAdapter(tenantId, channelId, fullPath);

    // 2. Setup Ingress Link
    adapter.onMessage(async (event) => {
      await IngressService.getInstance().handleMessage(event.tenantId, event.channelId, event.raw, mockContext, event.fullPath);
    });

    // 3. Setup Agent Mock
    vi.mocked(agentService.getAgent).mockResolvedValue({
      success: true,
      data: { id: agentId, name: 'Mastermind' } as any
    });

    await adapter.connect();

    // 4. Simulate Baileys Event
    const authInstance = vi.mocked(AuthSystem).mock.results[0].value;
    const connectResult = await authInstance.connect();
    const mockSocket = connectResult.data;
    const onCall = mockSocket.ev.on.mock.calls.find((call: any) => call[0] === 'messages.upsert');
    const baileysHandler = onCall[1];

    await baileysHandler({
      type: 'notify',
      messages: [{
        key: { remoteJid: 'user@s.whatsapp.net' },
        message: { conversation: 'hello integrated' },
        messageTimestamp: 9999999
      }]
    });

    // 5. Verify Ingress logic triggered AI based on path
    expect(agentService.getAgent).toHaveBeenCalledWith(tenantId, agentId);
    expect(mockContext.unifiedAI.processMessage).toHaveBeenCalled();
  });
});
