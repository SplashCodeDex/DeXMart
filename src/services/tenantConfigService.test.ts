import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantConfigService } from './tenantConfigService.js';
import { db } from '../lib/firebase.js';

// Mock Firestore
vi.mock('../lib/firebase.js', () => ({
    db: {
        collection: vi.fn().mockReturnThis(),
        doc: vi.fn().mockReturnThis(),
        get: vi.fn(),
        set: vi.fn(),
    },
}));

describe('TenantConfigService', () => {
    let service: TenantConfigService;
    const tenantId = 'tenant-123';
    const agentId = 'agent-456';
    const channelId = 'channel-789';

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton
        // @ts-ignore
        TenantConfigService.instance = undefined;
        service = TenantConfigService.getInstance();
    });

    describe('getChannelConfig', () => {
        it('should fetch from tenants/:tenantId/channels/:channelId by default', async () => {
            const mockDoc = {
                exists: true,
                data: () => ({ name: 'Test Channel' }),
            };
            vi.mocked(db.collection).mockReturnThis();
            vi.mocked(db.doc).mockReturnThis();
            vi.mocked(db.collection('').doc('').get).mockResolvedValue(mockDoc as any);

            const result = await service.getChannelConfig(tenantId, channelId);

            expect(result.success).toBe(true);
            expect(db.collection).toHaveBeenCalledWith('tenants');
            expect(db.doc).toHaveBeenCalledWith(tenantId);
            expect(db.collection).toHaveBeenCalledWith('channels');
            expect(db.doc).toHaveBeenCalledWith(channelId);
        });

        it('should fetch from tenants/:tenantId/agents/:agentId/channels/:channelId when agentId is provided', async () => {
            const mockDoc = {
                exists: true,
                data: () => ({ name: 'Nested Channel' }),
            };
            vi.mocked(db.collection('').doc('').get).mockResolvedValue(mockDoc as any);

            // THIS IS THE TARGET BEHAVIOR
            // Currently TenantConfigService.getChannelConfig only takes (tenantId, channelId)
            // @ts-ignore - passing extra arg to see if we can adapt it
            const result = await service.getChannelConfig(tenantId, channelId, agentId);

            expect(result.success).toBe(true);
            expect(db.collection).toHaveBeenCalledWith('tenants');
            expect(db.doc).toHaveBeenCalledWith(tenantId);
            expect(db.collection).toHaveBeenCalledWith('agents');
            expect(db.doc).toHaveBeenCalledWith(agentId);
            expect(db.collection).toHaveBeenCalledWith('channels');
            expect(db.doc).toHaveBeenCalledWith(channelId);
        });
    });

    describe('updateChannelConfig', () => {
        it('should update in tenants/:tenantId/agents/:agentId/channels/:channelId', async () => {
            const updates = { aiEnabled: true };
            const mockCurrentConfig = { exists: true, data: () => ({ aiEnabled: false }) };
            
            // For getChannelConfig call inside updateChannelConfig
            vi.mocked(db.collection('').doc('').get).mockResolvedValue(mockCurrentConfig as any);

            const result = await service.updateChannelConfig(tenantId, channelId, updates, agentId);

            expect(result.success).toBe(true);
            expect(db.collection).toHaveBeenCalledWith('agents');
            expect(db.doc).toHaveBeenCalledWith(agentId);
            expect(db.collection).toHaveBeenCalledWith('channels');
            expect(db.doc).toHaveBeenCalledWith(channelId);
            expect(db.set).toHaveBeenCalled();
        });
    });

    describe('resolveAgentChannelConfig', () => {
        it('should resolve from nested path if agentId provided', async () => {
            const mockChannelDoc = {
                exists: true,
                data: () => ({ name: 'Nested Channel', assignedAgentId: 'wrong-agent' }),
            };
            const mockAgentDoc = {
                exists: true,
                data: () => ({ name: 'Correct Agent', personality: 'Friendly' }),
            };

            // First call for channel, second for agent
            vi.mocked(db.collection('').doc('').get)
                .mockResolvedValueOnce(mockChannelDoc as any)
                .mockResolvedValueOnce(mockAgentDoc as any);

            const result = await service.resolveAgentChannelConfig(tenantId, channelId, agentId);

            expect(result.success).toBe(true);
            expect(result.data?.aiPersonality).toBe('Friendly');
            // Verify it used the provided agentId, not the one from channel data
            expect(db.doc).toHaveBeenCalledWith(agentId);
        });
    });
});
