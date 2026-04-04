import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { CampaignController } from '../controllers/campaignController.js';

const router = Router();

/**
 * GET /campaigns
 * List all campaigns for the tenant
 */
router.get('/', authenticateToken, CampaignController.listCampaigns);

/**
 * POST /campaigns
 * Create a new campaign
 */
router.post('/', authenticateToken, CampaignController.createCampaign);

router.post('/:id/start', authenticateToken, CampaignController.startCampaign);

router.post('/:id/pause', authenticateToken, CampaignController.pauseCampaign);

router.post('/:id/resume', authenticateToken, CampaignController.resumeCampaign);

router.post('/:id/duplicate', authenticateToken, CampaignController.duplicateCampaign);

router.delete('/:id', authenticateToken, CampaignController.deleteCampaign);

export default router;
