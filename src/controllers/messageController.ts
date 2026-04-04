import { Request, Response } from 'express';
import { z } from 'zod';
import logger from '../utils/logger.js';
import { channelManager } from '../services/channels/ChannelManager.js';
import { db } from '../lib/firebase.js';

// Validation Schemas
const sendMessageSchema = z.object({
    channelId: z.string().min(1),
    to: z.string().min(5),
    message: z.string().optional(),
    type: z.enum(['text', 'image', 'video', 'document']).default('text'),
    mediaUrl: z.string().url().optional(),
    caption: z.string().optional()
});

const replySchema = z.object({
    messageId: z.string().min(1),
    text: z.string().min(1),
});

export class MessageController {
    /**
     * List messages for a tenant (from Firestore history)
     */
    static async listMessages(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const limit = parseInt(req.query.limit as string) || 50;

            const snapshot = await db.collection('tenants')
                .doc(tenantId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json({ success: true, data: messages });
        } catch (error: any) {
            logger.error('MessageController.listMessages error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Send a reply to an existing message (OMNICHANNEL)
     */
    static async reply(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const { messageId, text } = replySchema.parse(req.body);

            // 1. Fetch original message to get context
            const messageRef = db.collection('tenants')
                .doc(tenantId)
                .collection('messages')
                .doc(messageId);

            const messageSnap = await messageRef.get();

            if (!messageSnap.exists) {
                return res.status(404).json({ success: false, error: 'Original message not found' });
            }

            const originalMessage = messageSnap.data() as any;
            const channelId = originalMessage.channelId;

            // 2. Send via the SAME channel
            const adapter = channelManager.getAdapter(channelId);
            if (!adapter) {
                return res.status(400).json({ success: false, error: 'Channel not connected or inactive' });
            }

            await adapter.sendMessage(originalMessage.remoteJid, { text });

            res.json({ success: true, data: { message: 'Reply sent' } });

        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ success: false, error: error.issues[0].message });
            }
            logger.error('MessageController.reply error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Send a message via a specific channel
     */
    static async sendMessage(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const payload = sendMessageSchema.parse(req.body);

            // 1. Resolve Adapter
            const adapter = channelManager.getAdapter(payload.channelId);
            if (!adapter) {
                return res.status(400).json({ success: false, error: 'Channel not active' });
            }

            // 2. Send Message
            await adapter.sendMessage(payload.to, {
                text: payload.message || '',
                mediaUrl: payload.mediaUrl,
                caption: payload.caption
            });

            res.json({ success: true, data: { status: 'sent' } });

        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ success: false, error: error.issues[0].message });
            }
            logger.error('MessageController.sendMessage error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}
