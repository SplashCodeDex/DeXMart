import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemAuthorityService } from './SystemAuthorityService.js';

// Mock Firestore
const mockGet = vi.fn();
vi.mock('../lib/firebase.js', () => ({
    db: {
        doc: vi.fn(() => ({
            get: mockGet
        }))
    }
}));

describe('SystemAuthorityService', () => {
    let service: SystemAuthorityService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = SystemAuthorityService.getInstance();
    });

    describe('getCapabilities', () => {
        it('should return starter capabilities by default', () => {
            const caps = service.getCapabilities('starter');
            expect(caps.maxMessages).toBe(1000);
            expect(caps.maxAgents).toBe(1);
            expect(caps.features.aiMessageSpinning).toBe(false);
        });

        it('should return enterprise capabilities', () => {
            const caps = service.getCapabilities('enterprise');
            expect(caps.maxMessages).toBe(10000000);
            expect(caps.maxAgents).toBe(100);
            expect(caps.features.aiMessageSpinning).toBe(true);
        });
    });

    describe('checkAuthority', () => {
        it('should allow message sending if under limit', async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    plan: 'starter',
                    stats: { totalMessagesSent: 500 }
                })
            });

            const result = await service.checkAuthority('tenant-1', 'send_message');
            expect(result.allowed).toBe(true);
        });

        it('should deny message sending if over limit', async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    plan: 'starter',
                    stats: { totalMessagesSent: 1000 }
                })
            });

            const result = await service.checkAuthority('tenant-1', 'send_message');
            expect(result.allowed).toBe(false);
            expect(result.error).toBe('Monthly message limit reached');
        });

        it('should deny agent creation if limit reached', async () => {
            // First mock for tenant plan
            mockGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ plan: 'starter' })
            });
            // Second mock for agent counter
            mockGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ agentCount: 1 })
            });

            const result = await service.checkAuthority('tenant-1', 'create_agent');
            expect(result.allowed).toBe(false);
            expect(result.error).toContain('Agent limit reached');
        });
    });
});
