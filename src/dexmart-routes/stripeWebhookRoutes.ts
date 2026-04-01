import { Router } from 'express';
import { handleStripeWebhook } from '../controllers/stripeWebhookController.js';

const router = Router();

// Signature verification uses rawBody captured in global middleware
router.post('/', handleStripeWebhook);

export default router;