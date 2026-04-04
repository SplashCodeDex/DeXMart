import { Request, Response } from 'express';
import { campaignService } from '../services/campaignService.js';

export class CampaignController {
    /**
     * List all campaigns for the tenant
     */
    static async listCampaigns(req: Request, res: Response) {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const result = await campaignService.getCampaigns(tenantId);
        if (result.success) {
            res.json({ success: true, data: result.data });
        } else {
            res.status(500).json({ success: false, error: result.error?.message || 'Failed to fetch campaigns' });
        }
    }

    /**
     * Create a new campaign
     */
    static async createCampaign(req: Request, res: Response) {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const result = await campaignService.createCampaign(tenantId, req.body);
        if (result.success) {
            res.status(201).json({ success: true, data: result.data });
        } else {
            res.status(400).json({ success: false, error: result.error?.message || 'Failed to create campaign' });
        }
    }

    /**
     * Start a campaign
     */
    static async startCampaign(req: Request, res: Response) {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const result = await campaignService.startCampaign(tenantId, id as string);
        if (result.success) {
            res.json({ success: true, data: { message: 'Campaign started' } });
        } else {
            res.status(400).json({ success: false, error: result.error?.message || 'Failed to start campaign' });
        }
    }

    /**
     * Pause a campaign
     */
    static async pauseCampaign(req: Request, res: Response) {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const result = await campaignService.pauseCampaign(tenantId, id as string);
        if (result.success) {
            res.json({ success: true, data: { message: 'Campaign paused' } });
        } else {
            res.status(400).json({ success: false, error: result.error?.message || 'Failed to pause campaign' });
        }
    }

    /**
     * Resume a campaign
     */
    static async resumeCampaign(req: Request, res: Response) {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const result = await campaignService.resumeCampaign(tenantId, id as string);
        if (result.success) {
            res.json({ success: true, data: { message: 'Campaign resumed' } });
        } else {
            res.status(400).json({ success: false, error: result.error?.message || 'Failed to resume campaign' });
        }
    }

    /**
     * Duplicate a campaign
     */
    static async duplicateCampaign(req: Request, res: Response) {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const result = await campaignService.duplicateCampaign(tenantId, id as string);
        if (result.success) {
            res.status(201).json({ success: true, data: result.data });
        } else {
            res.status(500).json({ success: false, error: result.error?.message || 'Failed to duplicate campaign' });
        }
    }

    /**
     * Delete a campaign
     */
    static async deleteCampaign(req: Request, res: Response) {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const result = await campaignService.deleteCampaign(tenantId, id as string);
        if (result.success) {
            res.json({ success: true, data: { message: 'Campaign deleted' } });
        } else {
            res.status(500).json({ success: false, error: result.error?.message || 'Failed to delete campaign' });
        }
    }
}
