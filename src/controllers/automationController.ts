import { Request, Response } from 'express';
import { automationService } from '../services/automationService.js';
import logger from '../utils/logger.js';
import { toggleAutomationSchema } from '@DeXMart/shared';

export class AutomationController {
    static async createAutomation(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const result = await automationService.createAutomation(tenantId, req.body);
            if (result.success) {
                res.status(201).json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error: any) {
            logger.error('AutomationController.createAutomation error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    static async listAutomations(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const result = await automationService.listAutomations(tenantId);
            res.json(result);
        } catch (error: any) {
            logger.error('AutomationController.listAutomations error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    static async toggleAutomation(req: Request, res: Response) {
        try {
            const { params, body } = toggleAutomationSchema.parse({
                params: req.params,
                body: req.body
            });
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const result = await automationService.toggleAutomation(tenantId, params.id, body.isActive);
            res.json(result);
        } catch (error: any) {
            logger.error('AutomationController.toggleAutomation error', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
            }
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}
