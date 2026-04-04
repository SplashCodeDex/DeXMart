import express from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { getFacebookWebhook } from '../utils/openclawImports.js';
import { channelService } from '../services/ChannelService.js';
import { ingressService } from '../services/IngressService.js';
import contextProvider from '../lib/context.js';
import crypto from 'node:crypto';

const router = express.Router();

const ChallengeQuerySchema = z.object({
  'hub.mode': z.string().optional(),
  'hub.verify_token': z.string().optional(),
  'hub.challenge': z.string().optional(),
}).catchall(z.unknown()); // Allow other query params if Meta sends them

/**
 * GET /api/facebook-webhook/:channelId
 * Challenge handler for Meta Webhook verification
 */
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const query = ChallengeQuerySchema.parse(req.query);

    const result = await channelService.findChannelByIdGlobally(channelId);
    
    if (!result.success) {
      logger.warn(`[FacebookWebhook] Challenge received for unknown channel: ${channelId}`);
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    const { channel } = result.data;
    const verifyToken = channel.credentials?.verifyToken;

    if (!verifyToken) {
      logger.warn(`[FacebookWebhook] No verifyToken configured for channel: ${channelId}`);
      return res.status(403).json({ success: false, error: 'Verification token missing in channel config' });
    }

    const { handleFacebookChallenge } = await getFacebookWebhook();
    
    const challengeResponse = handleFacebookChallenge(
      query['hub.mode'],
      query['hub.verify_token'],
      query['hub.challenge'],
      verifyToken
    );

    if (challengeResponse) {
       return res.status(200).send(challengeResponse);
    }
    return res.status(403).json({ success: false, error: 'Invalid challenge parameters' });

  } catch (error: any) {
    logger.error('[FacebookWebhook] Error during generic challenge handling:', error);
    return res.status(400).json({ success: false, error: 'Bad Request' });
  }
});

/**
 * POST /api/facebook-webhook/:channelId
 * Message handler for Facebook Messenger events
 */
router.post('/:channelId', async (req, res) => {
  const { channelId } = req.params;
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  try {
    const result = await channelService.findChannelByIdGlobally(channelId);
    if (!result.success) {
      logger.warn(`[FacebookWebhook] Message received for unknown channel: ${channelId}`);
      return res.sendStatus(404);
    }

    const { channel, tenantId, agentId } = result.data;
    const appSecret = channel.credentials?.appSecret;

    // Use rawBody for accurate HMAC signature validation if available, else JSON.stringify
    // Body parsing middleware needs to populate rawBody
    const rawBody = (req as any).rawBody?.toString() || JSON.stringify(req.body);

    const { validateFacebookSignature, normalizeFacebookEvents } = await getFacebookWebhook();

    if (!appSecret || !validateFacebookSignature(rawBody, signature, appSecret)) {
      logger.warn(`[FacebookWebhook] Signature validation failed for channel: ${channelId}`);
      return res.sendStatus(403);
    }

    const events = normalizeFacebookEvents(req.body);
    const context = await contextProvider();
    const fullPath = `tenants/${tenantId}/agents/${agentId}/channels/${channelId}`;

    for (const event of events) {
      // event represents the inner message object from Meta
      const messageId = event.message?.mid || crypto.randomUUID();
      const senderId = event.sender?.id || 'unknown';
      const text = event.message?.text || '';

      await ingressService.handleCommonMessage(tenantId, channelId, {
        id: messageId,
        platform: 'facebook',
        from: senderId,
        to: channelId,
        content: { text },
        timestamp: event.timestamp || Date.now(),
        metadata: { raw: event, fullPath }
      }, context, fullPath);
    }

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('[FacebookWebhook] Error processing inbound webhook:', error);
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
});

export default router;
