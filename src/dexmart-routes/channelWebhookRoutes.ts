import { Router, Request, Response } from 'express';
import { channelManager } from '../services/channels/ChannelManager.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/webhook/:channelId
 * Handle incoming updates for any channel that supports webhooks
 */
router.post('/:channelId', async (req: Request, res: Response) => {
    const channelId = req.params.channelId as string;

    // Look up by instanceId (which is chan_...)
    const adapter = channelManager.getAdapter(channelId);

    if (!adapter) {
        logger.warn(`[ChannelWebhook] Received webhook for unknown channel: ${channelId}`);
        return res.status(200).send('OK (Unknown Channel)');
    }

    if (!adapter.handleWebhook) {
        logger.error(`[ChannelWebhook] Adapter ${adapter.id} (${channelId}) does not implement handleWebhook`);
        return res.status(500).send('Webhook handler not implemented');
    }

    try {
        await adapter.handleWebhook(req, res);
    } catch (error) {
        logger.error(`[ChannelWebhook] Error handling webhook for ${channelId} (${adapter.id}):`, error);
        if (!res.headersSent) {
            res.status(500).send('Internal Server Error');
        }
    }
});

/**
 * Legacy support for Telegram tokens
 */
router.post('/telegram/:token', async (req: Request, res: Response) => {
    const token = req.params.token as string;
    const adapter = channelManager.getAdapter(token);

    if (!adapter) {
        logger.warn(`[TelegramWebhook] Received webhook for unknown token: ${token}`);
        return res.status(200).send('OK (Unknown Bot)');
    }

    if (!adapter.handleWebhook) {
        return res.status(500).send('Webhook handler not implemented');
    }

    try {
        await adapter.handleWebhook(req, res);
    } catch (error) {
        logger.error(`[TelegramWebhook] Error handling legacy webhook:`, error);
        if (!res.headersSent) {
            res.status(500).send('Internal Server Error');
        }
    }
});

export default router;
