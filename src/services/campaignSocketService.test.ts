import { describe, it, expect, beforeEach, vi } from 'vitest';
import { campaignSocketService } from './campaignSocketService.js';
import { Server } from 'socket.io';

// Mock Socket.io
const mockIo = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis()
};

describe('CampaignSocketService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-ignore - access private
        campaignSocketService.io = mockIo;
    });

    it('should emit progress to the correct tenant room', () => {
        const tenantId = 'tenant_1';
        const campaignId = 'camp_123';
        const stats = { sent: 10, failed: 2, total: 50 };

        const result = campaignSocketService.emitProgress(tenantId, campaignId, stats);

        expect(result.success).toBe(true);
        expect(mockIo.to).toHaveBeenCalledWith(`tenants:${tenantId}`);
        expect(mockIo.emit).toHaveBeenCalledWith('campaign_update', expect.objectContaining({
            campaignId,
            stats
        }));
    });

    it('should return error if not initialized', () => {
        // @ts-ignore
        campaignSocketService.io = null;
        const result = campaignSocketService.emitProgress('t1', 'c1', {});
        expect(result.success).toBe(false);
    });
});
