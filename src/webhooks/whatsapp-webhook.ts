import express from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { validateWhatsAppSignature } from '../utils/security.js';

const router = express.Router();

// Webhook verification (required by Meta)
router.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info('WhatsApp webhook verification attempt', { mode, token: token ? '***' : null });

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('WhatsApp webhook verification failed', { mode, tokenProvided: !!token });
    res.sendStatus(403);
  }
});

// Webhook message handler
router.post('/webhook/whatsapp', express.json(), async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];

    if (typeof signature !== 'string') {
      logger.warn('Missing or invalid signature header');
      return res.sendStatus(403);
    }

    // Validate request signature (security)
    if (!validateWhatsAppSignature(req.body, signature)) {
      logger.warn('Invalid WhatsApp webhook signature');
      return res.sendStatus(403);
    }

    logger.info('WhatsApp webhook message received', {
      body: req.body,
      signature: signature ? '***' : null,
    });

    // Process incoming message
    const { entry } = req.body;

    if (entry && entry.length > 0) {
      for (const entryItem of entry) {
        const { changes } = entryItem;

        if (changes && changes.length > 0) {
          for (const change of changes) {
            if (change.field === 'messages') {
              // Handle message logic here
              // This would integrate with your existing Baileys logic
              logger.info('Processing WhatsApp message', { change });
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('WhatsApp webhook error', { error: error.message, stack: error.stack });
    res.sendStatus(500);
  }
});

export default router;
