import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refresh } from './authController.js';
import { db } from '@/lib/firebase.js';
import { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';

// Mock dependencies
vi.mock('@/lib/firebase.js', () => {
    const mockGet = vi.fn();
    const mockBatch = {
        delete: vi.fn(),
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue({}),
    };

    const mockCollection: any = vi.fn(() => ({
        doc: vi.fn(() => ({
            get: mockGet,
            delete: vi.fn().mockResolvedValue({}),
        })),
    }));

    return {
        db: {
            collection: mockCollection,
            batch: vi.fn(() => mockBatch),
        },
        admin: {
            auth: () => ({
                createCustomToken: vi.fn().mockResolvedValue('custom-token'),
            }),
        },
    };
});

vi.mock('@/services/ConfigService.js', () => ({
    ConfigService: {
        getInstance: () => ({
            get: vi.fn().mockReturnValue('jwt-secret'),
        }),
    },
}));

describe('authController - refresh', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        vi.clearAllMocks();
        req = {
            cookies: { refreshToken: 'old-refresh-token' },
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            cookie: vi.fn().mockReturnThis(),
        };
    });

    it('should fail if no refresh token provided', async () => {
        req.cookies = {};
        await refresh(req as Request, res as Response);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should rotate tokens for valid refresh token', async () => {
        const mockRt = {
            exists: true,
            data: () => ({
                userId: 'user-1',
                tenantId: 'tenant-1',
                familyId: 'family-1',
                expiresAt: Timestamp.fromDate(new Date(Date.now() + 10000)),
            }),
            ref: { delete: vi.fn() },
        };

        const mockGet = (db.collection('any').doc('any').get as any);
        mockGet.mockResolvedValueOnce(mockRt);
        mockGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ email: 'test@example.com', role: 'owner' }),
        });

        await refresh(req as Request, res as Response);

        expect(db.batch).toHaveBeenCalled();
        expect(res.cookie).toHaveBeenCalledWith('token', expect.any(String), expect.any(Object));
        expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.any(Object));
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should fail for non-existent token (Potential Fraud)', async () => {
        (db.collection('refreshTokens').doc('old-refresh-token').get as any).mockResolvedValue({ exists: false });

        await refresh(req as Request, res as Response);

        expect(res.status).toHaveBeenCalledWith(403);
    });
});
