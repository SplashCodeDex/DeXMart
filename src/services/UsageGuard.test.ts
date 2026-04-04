import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsageGuard } from './UsageGuard.js';

// Mock dependencies
const mockDoc = vi.fn();
vi.mock('../lib/firebase.js', () => ({
    db: {
        doc: (path: string) => mockDoc(path),
        batch: vi.fn().mockReturnValue({
            set: vi.fn(),
            update: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined)
        })
    }
}));

describe('UsageGuard', () => {
    let guard: UsageGuard;

    beforeEach(() => {
        vi.clearAllMocks();
        guard = UsageGuard.getInstance();
    });

    it('should allow sending if within Starter limit (1000)', () => {
        expect(guard.canSend('starter', 500)).toBe(true);
        expect(guard.canSend('starter', 1000)).toBe(false);
    });

    it('should allow sending if within Pro limit (10000)', () => {
        expect(guard.canSend('pro', 9999)).toBe(true);
        expect(guard.canSend('pro', 10000)).toBe(false);
    });

    it('should allow sending for Enterprise (effectively unlimited)', () => {
        expect(guard.canSend('enterprise', 1000000)).toBe(true);
    });

    describe('checkAndIncrementUsage', () => {
        const tenantId = 'tenant-123';

        it('should return allowed: true and increment if under limit', async () => {
            mockDoc.mockReturnValue({
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({ plan: 'starter', stats: { totalMessagesSent: 500 } })
                })
            });

            const result = await guard.checkAndIncrementUsage(tenantId);

            expect(result.allowed).toBe(true);
            expect(mockDoc).toHaveBeenCalledWith(`tenants/${tenantId}`);
        });

        it('should return allowed: false if over limit', async () => {
            mockDoc.mockReturnValue({
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({ plan: 'starter', stats: { totalMessagesSent: 1000 } })
                })
            });

            const result = await guard.checkAndIncrementUsage(tenantId);

            expect(result.allowed).toBe(false);
            expect(result.error).toBe('Monthly usage limit reached');
        });

        it('should return allowed: false if tenant not found', async () => {
            mockDoc.mockReturnValue({
                get: vi.fn().mockResolvedValue({ exists: false })
            });

            const result = await guard.checkAndIncrementUsage(tenantId);

            expect(result.allowed).toBe(false);
            expect(result.error).toBe('Tenant not found');
        });
    });
});
