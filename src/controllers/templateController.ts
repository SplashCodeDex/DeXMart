import { Request, Response } from 'express';
import { TemplateService } from '../services/templateService.js';
import { GeminiAI } from '../services/geminiAI.js';
import logger from '../utils/logger.js';

export const getTemplatesController = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const service = TemplateService.getInstance();
        const result = await service.getTemplates(tenantId);

        return res.json(result);
    } catch (error: any) {
        logger.error('getTemplatesController error', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const createTemplateController = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const service = TemplateService.getInstance();
        const result = await service.createTemplate(tenantId, req.body);

        if (result.success) {
            return res.status(201).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error: any) {
        logger.error('createTemplateController error', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const spinMessageController = async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { content } = req.body;
        if (!content) return res.status(400).json({ success: false, error: 'Content is required' });

        const result = await GeminiAI.spinMessage(content, tenantId);

        if (result.success) {
            return res.json(result);
        } else {
            return res.status(500).json(result);
        }
    } catch (error: any) {
        logger.error('spinMessageController error', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
