import { Request, Response } from 'express';
import { z } from 'zod';
import logger from '@/utils/logger.js';
import { ContactService } from '@/services/contactService.js';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

export class ContactController {
    /**
     * Import contacts from CSV
     */
    static async importContacts(req: Request, res: Response) {
        const filePath = req.file?.path;
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                if (filePath) await fs.unlink(filePath).catch(() => { });
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            if (!filePath) {
                return res.status(400).json({ success: false, error: 'CSV file is required' });
            }

            const service = ContactService.getInstance();
            const channelId = (req.query?.channelId || req.body?.channelId || req.query?.botId || req.body?.botId) as string;
            const result = await service.importContacts(tenantId, filePath, channelId);

            if (!result.success) {
                return res.status(500).json({ success: false, error: result.error.message });
            }

            res.json({ success: true, data: result.data });
        } catch (error: unknown) {
            logger.error('ContactController.importContacts error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        } finally {
            if (filePath && existsSync(filePath)) {
                await fs.unlink(filePath).catch(() => { });
            }
        }
    }

    /**
     * List all contacts for a tenant
     */
    static async listContacts(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const limit = parseInt(req.query.limit as string) || 100;
            const service = ContactService.getInstance();
            const result = await service.listContacts(tenantId, limit);

            if (!result.success) {
                return res.status(500).json({ success: false, error: result.error.message });
            }

            res.json({ success: true, data: result.data });
        } catch (error: unknown) {
            logger.error('ContactController.listContacts error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Create a new contact
     */
    static async createContact(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const body = req.body;
            const rawData = {
                name: body.name,
                phone: body.phone || body.phoneNumber,
                email: body.email || '',
                tags: body.tags || [],
                attributes: body.attributes || body.metadata || {},
            };

            const service = ContactService.getInstance();
            const result = await service.createContact(tenantId, rawData);

            if (!result.success) {
                if (result.error instanceof z.ZodError) {
                    return res.status(400).json({ success: false, error: result.error.issues[0].message });
                }
                return res.status(500).json({ success: false, error: result.error.message });
            }

            res.status(201).json({ success: true, data: result.data });
        } catch (error: unknown) {
            logger.error('ContactController.createContact error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Update a contact
     */
    static async updateContact(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            const contactId = req.params.id as string;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            if (Object.keys(req.body).length === 0) {
                return res.status(400).json({ success: false, error: 'Request body cannot be empty.' });
            }

            const body = req.body;
            const updates: Record<string, unknown> = {};
            if (body.name) updates.name = body.name;
            if (body.phone || body.phoneNumber) updates.phone = body.phone || body.phoneNumber;
            if (body.email !== undefined) updates.email = body.email;
            if (body.tags) updates.tags = body.tags;
            if (body.attributes || body.metadata) updates.attributes = body.attributes || body.metadata;

            const service = ContactService.getInstance();
            const result = await service.updateContact(tenantId, contactId, updates);

            if (!result.success) {
                if (result.error instanceof z.ZodError) {
                    return res.status(400).json({ success: false, error: result.error.issues[0].message });
                }
                return res.status(500).json({ success: false, error: result.error.message });
            }

            res.json({ success: true, data: { message: 'Contact updated' } });
        } catch (error: unknown) {
            logger.error('ContactController.updateContact error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Delete a contact
     */
    static async deleteContact(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            const contactId = req.params.id as string;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const service = ContactService.getInstance();
            const result = await service.deleteContact(tenantId, contactId);

            if (!result.success) {
                return res.status(500).json({ success: false, error: result.error.message });
            }

            res.json({ success: true, data: { message: 'Contact deleted' } });
        } catch (error: unknown) {
            logger.error('ContactController.deleteContact error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Check for duplicate contacts by phone number
     */
    static async checkDuplicates(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const phones = req.body.phones;
            if (!Array.isArray(phones)) {
                return res.status(400).json({ success: false, error: 'Phones array is required' });
            }

            const service = ContactService.getInstance();
            const result = await service.checkDuplicates(tenantId, phones);

            if (!result.success) {
                return res.status(500).json({ success: false, error: result.error.message });
            }

            res.json({ success: true, data: result.data });
        } catch (error: unknown) {
            logger.error('ContactController.checkDuplicates error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * List import history
     */
    static async listImportHistory(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const service = ContactService.getInstance();
            const result = await service.listImportHistory(tenantId);

            if (!result.success) {
                return res.status(500).json({ success: false, error: result.error.message });
            }

            res.json({ success: true, data: result.data });
        } catch (error: unknown) {
            logger.error('ContactController.listImportHistory error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Undo a specific import
     */
    static async undoImport(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            const importId = req.params.id as string;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const service = ContactService.getInstance();
            const result = await service.undoImport(tenantId, importId);

            if (!result.success) {
                return res.status(500).json({ success: false, error: result.error.message });
            }

            res.json({ success: true, data: { message: 'Import undone successfully' } });
        } catch (error: unknown) {
            logger.error('ContactController.undoImport error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Get audiences (segments) for a tenant
     */
    static async getAudiences(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const service = ContactService.getInstance();
            const result = await service.getAudience(tenantId);

            if (!result.success) {
                return res.status(500).json({ success: false, error: result.error.message });
            }

            res.json({ success: true, data: result.data });
        } catch (error: unknown) {
            logger.error('ContactController.getAudiences error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}
