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

describe('WhatsappAdapter', () => {
  let adapter: WhatsappAdapter;
  const tenantId = 'tenant-123';
  const channelId = 'chan-456';

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new WhatsappAdapter(tenantId, channelId);
  });

  it('should initialize with correct identifiers', () => {
    expect(adapter.id).toBe('whatsapp');
    expect(adapter.instanceId).toBe(channelId);
  });

  it('should connect via AuthSystem', async () => {
    await adapter.connect();
    
    const authInstance = vi.mocked(AuthSystem).mock.results[0].value;
    expect(authInstance.connect).toHaveBeenCalled();
  });

  it('should disconnect and clear listener', async () => {
    await adapter.connect();
    await adapter.disconnect();

    const authInstance = vi.mocked(AuthSystem).mock.results[0].value;
    expect(authInstance.disconnect).toHaveBeenCalled();
  });
});
