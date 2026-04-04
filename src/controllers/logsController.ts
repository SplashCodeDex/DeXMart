import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';

export const handleClientLog = (req: Request, res: Response) => {
    try {
        const { level, message, context, url, userAgent } = req.body;

        if (!level || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const logData = { source: 'client-side', url, userAgent, context };

        switch (level) {
            case 'error': logger.error(`[Frontend] ${message}`, logData); break;
            case 'warn': logger.warn(`[Frontend] ${message}`, logData); break;
            case 'info': logger.info(`[Frontend] ${message}`, logData); break;
            case 'debug': logger.debug(`[Frontend] ${message}`, logData); break;
            default: logger.info(`[Frontend] ${message}`, logData);
        }

        res.status(200).json({ status: 'ok' });
    } catch (e) {
        logger.error('[Frontend Log API] Failed', { error: String(e) });
        res.status(500).json({ error: 'Failed' });
    }
};
