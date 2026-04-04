import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin and the internal firebase lib
vi.mock('firebase-admin', () => ({
    default: {
        apps: [],
        initializeApp: vi.fn(),
        credential: {
            cert: vi.fn(),
            applicationDefault: vi.fn(),
        },
        firestore: () => ({
            collection: vi.fn().mockReturnThis(),
            doc: vi.fn().mockReturnThis(),
        }),
    },
}));

vi.mock('../lib/firebase.js', () => ({
    db: {
        collection: vi.fn().mockReturnValue({
            doc: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ exists: false }),
        }),
    },
    admin: {},
}));

import { firebaseService } from './FirebaseService.js';

describe('FirebaseService Path Validation', () => {
    it('should throw an error for docId with undefined segments', async () => {
        await expect(firebaseService.getDoc('channels', 'undefined', 'tenant-123'))
            .rejects.toThrow('Invalid Firestore path segment detected');
    });

    it('should throw an error for empty tenantId', async () => {
        await expect(firebaseService.getDoc('channels', '123', ''))
            .rejects.toThrow('Firestore path is required');
    });

    it('should throw an error for malformed nested paths', async () => {
        // This simulates agents//channels
        await expect(firebaseService.getDoc('agents//channels', '123', 'tenant-123'))
            .rejects.toThrow();
    });

    it('should throw an error if collection contains "undefined" string', async () => {
        await expect(firebaseService.getDoc('agents/undefined/channels', '123', 'tenant-123'))
            .rejects.toThrow('Invalid Firestore path segment detected');
    });
});
