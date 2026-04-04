import express from 'express';
import { IntegrationController } from '../controllers/integrationController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/integrations/google/auth-url
 * Returns the URL for tenant to authorize Google Drive
 */
router.get('/google/auth-url', authenticateToken, IntegrationController.getGoogleAuthUrl);

/**
 * GET /api/integrations/google/callback
 * Target for Google OAuth redirect
 */
router.get('/google/callback', IntegrationController.handleGoogleCallback);

export default router;
