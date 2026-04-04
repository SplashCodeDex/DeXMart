import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/webhooks
 * List all webhooks for the tenant
 */
router.get('/', authenticateToken, WebhookController.listWebhooks);

/**
 * POST /api/webhooks
 * Create a new webhook
 */
router.post('/', authenticateToken, WebhookController.createWebhook);

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', authenticateToken, WebhookController.deleteWebhook);

export default router;
