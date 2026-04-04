import { Request, Response } from 'express';
import { webhookService } from '../services/webhookService.js';
import logger from '../utils/logger.js';
import { deleteWebhookSchema } from '@DeXMart/shared';

export class WebhookController {
    /**
     * List all webhooks for the tenant
     */
    static async listWebhooks(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const result = await webhookService.getWebhooks(tenantId);

            if (result.success) {
                res.json({ success: true, data: result.data });
            } else {
                res.status(500).json({ success: false, error: result.error?.message || 'Failed to fetch webhooks' });
            }
        } catch (error: any) {
            logger.error('WebhookController.listWebhooks error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Create a new webhook
     */
    static async createWebhook(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            const actor = Array.isArray(req.user?.userId) ? req.user.userId[0] : (req.user?.userId || 'unknown');
            const ip = req.ip || 'unknown';

            if (!tenantId) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const result = await webhookService.createWebhook(tenantId, req.body, { actor, ip });

            if (result.success) {
                res.status(201).json({ success: true, data: result.data });
            } else {
                res.status(400).json({ success: false, error: result.error?.message || 'Failed to create webhook' });
            }
        } catch (error: any) {
            logger.error('WebhookController.createWebhook error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Delete a webhook
     */
    static async deleteWebhook(req: Request, res: Response) {
        try {
            const { params } = deleteWebhookSchema.parse({ params: req.params });
            const tenantId = req.user?.tenantId;
            const actor = Array.isArray(req.user?.userId) ? req.user.userId[0] : (req.user?.userId || 'unknown');
            const ip = req.ip || 'unknown';

            if (!tenantId) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const result = await webhookService.deleteWebhook(tenantId, params.id, { actor, ip });

            if (result.success) {
                res.json({ success: true, data: { message: 'Webhook deleted' } });
            } else {
                res.status(500).json({ success: false, error: result.error?.message || 'Failed to delete webhook' });
            }
        } catch (error: any) {
            logger.error('WebhookController.deleteWebhook error', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
            }
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}
