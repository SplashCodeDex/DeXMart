import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhatsappAdapter } from './WhatsappAdapter.js';
import AuthSystem from '@/services/authSystem.js';

// Mock dependencies
vi.mock('@/services/authSystem.js', () => {
  return {
    default: vi.fn().mockImplementation(function() {
      return {
        connect: vi.fn().mockResolvedValue({ success: true, data: { ev: { on: vi.fn() }, sendMessage: vi.fn() } }),
        disconnect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        updatePath: vi.fn(),
        getQRCode: vi.fn().mockResolvedValue({ success: true, data: null })
      };
    })
  };
});

vi.mock('@/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/utils/openclawImports.js', () => ({
  getWebOutbound: vi.fn(),
  getWebActiveListener: vi.fn()
}));

describe('WhatsappAdapter Path-Awareness', () => {
  let adapter: any;
  const tenantId = 'tenant-123';
  const channelId = 'chan-456';
  const fullPath = `tenants/${tenantId}/agents/system_default/channels/${channelId}`;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - testing new constructor signature
    adapter = new WhatsappAdapter(tenantId, channelId, fullPath);
  });

  it('should store and use fullPath', () => {
    expect(adapter.fullPath).toBe(fullPath);
  });

  it('should include fullPath in inbound message events', async () => {
    const messageHandler = vi.fn();
    adapter.onMessage(messageHandler);

    await adapter.connect();
    
    // Get the instance created by new AuthSystem
    const authInstance = vi.mocked(AuthSystem).mock.results[0].value;
    const connectResult = await authInstance.connect();
    const mockSocket = connectResult.data;
    
    const onCall = mockSocket.ev.on.mock.calls.find((call: any) => call[0] === 'messages.upsert');
    const handler = onCall[1];

    await handler({
      type: 'notify',
      messages: [{
        key: { remoteJid: 'user@s.whatsapp.net' },
        message: { conversation: 'hi' },
        messageTimestamp: 123456789
      }]
    });

    expect(messageHandler).toHaveBeenCalledWith(expect.objectContaining({
      fullPath: fullPath
    }));
  });
});
