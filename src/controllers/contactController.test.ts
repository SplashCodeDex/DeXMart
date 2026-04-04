import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { ContactController } from './contactController.js';
import { ContactService } from '../services/contactService.js';
import fs from 'fs';

// Mock fs
vi.mock('fs/promises', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        unlink: vi.fn().mockResolvedValue(undefined),
    };
});
vi.mock('fs', async (importOriginal) => {
    const original = await importOriginal<any>();
    return {
        ...original,
        default: {
            ...original.default,
            existsSync: vi.fn().mockReturnValue(true),
        },
        existsSync: vi.fn().mockReturnValue(true),
    };
});

// Mock ContactService
const mockContactService = {
    importContacts: vi.fn()
};

vi.mock('../services/contactService.js', () => ({
    ContactService: {
        getInstance: () => mockContactService
    }
}));

describe('ContactController', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockReq = {
            file: {
                path: 'test/path.csv'
            } as any,
            user: {
                tenantId: 'tenant-1'
            } as any,
            query: {},
            body: {}
        };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
    });

    describe('importContacts', () => {
        it('should call service and return result', async () => {
            mockContactService.importContacts.mockResolvedValue({
                success: true,
                data: { count: 1, errors: [] }
            });

            await ContactController.importContacts(mockReq as Request, mockRes as Response);

            expect(mockContactService.importContacts).toHaveBeenCalledWith('tenant-1', 'test/path.csv', undefined);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: { count: 1, errors: [] }
            });
        });

        it('should handle service errors', async () => {
             mockContactService.importContacts.mockResolvedValue({
                success: false,
                error: new Error('Failed')
            });

            await ContactController.importContacts(mockReq as Request, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });
        
        it('should require file', async () => {
             mockReq.file = undefined;
             
             await ContactController.importContacts(mockReq as Request, mockRes as Response);
             
             expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });
});
