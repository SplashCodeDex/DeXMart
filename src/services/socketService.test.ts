import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocketService } from './socketService.js';

// Mock Server from socket.io
const mockIo = {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn()
};

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = SocketService.getInstance();
    // Inject mock io
    (service as any).io = mockIo;
  });

  it('should emit channel progress update to correct room', () => {
    const tenantId = 'tenant-1';
    const channelId = 'channel-1';

    service.emitChannelProgress(tenantId, channelId, 'Testing', 'in_progress');

    expect(mockIo.to).toHaveBeenCalledWith('tenants:tenant-1');
    expect(mockIo.emit).toHaveBeenCalledWith('channel_progress_update', expect.objectContaining({
      channelId,
      step: 'Testing',
      status: 'in_progress'
    }));
  });

  it('should emit activity event to correct room', () => {
    const tenantId = 'tenant-1';
    const channelId = 'channel-1';

    service.emitActivity(tenantId, channelId, 'whatsapp', 'inbound', 'Hello');

    expect(mockIo.to).toHaveBeenCalledWith('tenants:tenant-1');
    expect(mockIo.emit).toHaveBeenCalledWith('activity_event', expect.objectContaining({
      channelId,
      platform: 'whatsapp',
      type: 'inbound',
      message: 'Hello'
    }));
  });
});
