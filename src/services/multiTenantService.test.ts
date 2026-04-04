vi.mock('./ChannelService.js', () => ({
    channelService: {
        getAllChannelsAcrossAgents: vi.fn()
    }
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiTenantService } from './multiTenantService.js';
import { FirebaseService } from './FirebaseService.js';
import { channelService } from './ChannelService.js';

// Hoist mocks
const { mockFirebaseService } = vi.hoisted(() => {
    return {
        mockFirebaseService: {
            getInstance: vi.fn(),
            getDoc: vi.fn(),
            getCollection: vi.fn(),
        }
    };
});

// Mock dependencies
vi.mock('@/services/FirebaseService.js', () => ({
    firebaseService: { // Mock the exported instance directly if possible, or the class
        getDoc: mockFirebaseService.getDoc,
        getCollection: mockFirebaseService.getCollection,
    },
    FirebaseService: {
        getInstance: () => ({
            getDoc: mockFirebaseService.getDoc,
            getCollection: mockFirebaseService.getCollection,
        })
    }
}));

// Mock logger to suppress errors
vi.mock('@/utils/logger.js', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('MultiTenantService', () => {
    let service: MultiTenantService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = MultiTenantService.getInstance();
    });

    describe('canAddChannel', () => {
        it('should return true if channel count is less than maxChannels', async () => {
            // Mock Tenant with pro plan (maxBots = 3)
            mockFirebaseService.getDoc.mockResolvedValueOnce({
                id: 'tenant-1',
                name: 'Test Tenant',
                plan: 'pro',
                status: 'active',
                subscriptionStatus: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                settings: { aiEnabled: true }
            });

            // Mock existing channels (count = 1)
            (channelService.getAllChannelsAcrossAgents as any).mockResolvedValueOnce({
                success: true,
                data: [
                    { id: 'chan-1' }
                ]
            });

            const result = await service.canAddChannel('tenant-1');
            if (!result.success) console.error('Test Failed Error:', result.error);
            expect(result.success).toBe(true);
            expect(result.data).toBe(true);
        });

        it('should return false if channel count equals maxChannels', async () => {
            // Mock Tenant with starter plan (maxBots = 1)
            mockFirebaseService.getDoc.mockResolvedValueOnce({
                id: 'tenant-1',
                name: 'Test Tenant',
                plan: 'starter',
                status: 'active',
                subscriptionStatus: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                settings: { aiEnabled: false }
            });

            // Mock existing channels (count = 1)
            (channelService.getAllChannelsAcrossAgents as any).mockResolvedValueOnce({
                success: true,
                data: [
                    { id: 'chan-1' }
                ]
            });

            const result = await service.canAddChannel('tenant-1');
            expect(result.success).toBe(true); // check executed successfully
            expect(result.data).toBe(false); // but user cannot add channel
        });

        it('should handle missing settings and default to 1 channel', async () => {
            // Mock Tenant with missing plan (defaults to starter)
            mockFirebaseService.getDoc.mockResolvedValueOnce({
                id: 'tenant-1',
                name: 'Test Tenant',
                plan: 'starter',
                status: 'active',
                subscriptionStatus: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                // missing settings
                settings: {}
            });

            (channelService.getAllChannelsAcrossAgents as any).mockResolvedValueOnce({
                success: true,
                data: [
                    { id: 'chan-1' }
                ]
            });

            const result = await service.canAddChannel('tenant-1');
            // Default maxChannels is 1. Existing is 1. Should be false.
            expect(result.success).toBe(true);
            expect(result.data).toBe(false);
        });

        it('should return error if tenant not found', async () => {
            mockFirebaseService.getDoc.mockResolvedValueOnce(null);

            const result = await service.canAddChannel('tenant-missing');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
