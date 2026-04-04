import express from 'express';
import { 
    getTemplatesController, 
    createTemplateController, 
    spinMessageController 
} from '../controllers/templateController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /templates
 * List all templates for a tenant
 */
router.get('/', authenticateToken, getTemplatesController);

/**
 * POST /templates
 * Create a new template
 */
router.post('/', authenticateToken, createTemplateController);

/**
 * POST /templates/spin
 * Rephrase a message while preserving variables
 */
router.post('/spin', authenticateToken, spinMessageController);

export default router;