import { Request, Response } from 'express';
import { tenantConfigService } from '../services/tenantConfigService.js';
import logger from '../utils/logger.js';
import { TenantSettingsSchema } from '../types/tenantConfig.js';

export class TenantSettingsController {
    /**
     * Retrieves the current tenant's settings
     */
    static async getSettings(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const result = await tenantConfigService.getTenantSettings(tenantId);

            if (result.success) {
                res.json({ success: true, data: result.data });
            } else {
                res.status(500).json({ success: false, error: 'Failed to fetch settings' });
            }
        } catch (error: any) {
            logger.error('TenantSettingsController.getSettings error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Updates the current tenant's settings
     */
    static async updateSettings(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            const actor = Array.isArray(req.user?.userId) ? req.user.userId[0] : (req.user?.userId || 'unknown');
            const ip = req.ip;

            if (!tenantId) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            // Service expects Partial<TenantSettings>, but let's validate against schema partial
            const parseResult = TenantSettingsSchema.partial().safeParse(req.body);

            if (!parseResult.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: (parseResult as any).error.errors
                });
            }

            const result = await tenantConfigService.updateTenantSettings(tenantId, parseResult.data, { actor, ip });

            if (result.success) {
                res.json({ success: true, data: result.data });
            } else {
                res.status(500).json({ success: false, error: 'Failed to update settings' });
            }
        } catch (error: any) {
            logger.error('TenantSettingsController.updateSettings error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}
