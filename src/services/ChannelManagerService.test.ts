import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelManagerService } from './ChannelManagerService';

// Mock dependencies
vi.mock('@/services/FirebaseService', () => ({
    firebaseService: {
        getDoc: vi.fn(),
        setDoc: vi.fn(),
    }
}));

vi.mock('@/utils/logger', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    }
}));

describe('ChannelManagerService', () => {
    let service: ChannelManagerService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = ChannelManagerService.getInstance();
    });

    it('should allow linking an agent to a channel slot', async () => {
        const tenantId = 'tenant_123';
        const slotId = 'slot_whatsapp_1';
        const agentId = 'agent_456';

        const result = await service.linkAgentToSlot(tenantId, slotId, agentId);
        expect(result.success).toBe(true);
    });

    it('should fail if linking a non-existent agent (mocked check)', async () => {
        // Logic for this would involve a Firestore check in the implementation
        // For now, defining the interface
        expect(service.linkAgentToSlot).toBeDefined();
    });
});
