import { Request, Response } from 'express';
import { systemAuthorityService } from '../services/SystemAuthorityService.js';
import logger from '../utils/logger.js';

/**
 * AuthorityController
 * 
 * Handles requests related to tenant capabilities and system gating.
 */
export class AuthorityController {
    /**
     * GET /api/authority/capabilities
     * Returns the user's specific capability matrix based on their billing tier.
     */
    public static async getCapabilities(req: Request, res: Response) {
        try {
            const user = req.user;
            if (!user || !user.tenantId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            // In a real scenario, we might want to fetch the latest tenant data from DB 
            // to get the current plan, but for now we trust the JWT or fallback to starter.
            // A more robust way is to use SystemAuthorityService to fetch the tenant doc.
            
            const { db } = await import('../lib/firebase.js');
            const tenantRef = db.doc(`tenants/${user.tenantId}`);
            const doc = await tenantRef.get();
            
            const plan = (doc.exists ? doc.data()!.plan : 'starter') || 'starter';
            const capabilities = systemAuthorityService.getCapabilities(plan);

            res.json({
                success: true,
                data: {
                    tier: plan,
                    capabilities
                }
            });
        } catch (error: any) {
            logger.error('AuthorityController.getCapabilities error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
