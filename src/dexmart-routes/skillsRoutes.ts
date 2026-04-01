import express, { Request, Response } from 'express';
import { skillsManager } from '../services/skillsManager.js';
import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /skills
 * List all available skills and whether they are enabled for the current tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Get tenant tier
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    const tier = tenantDoc.data()?.plan || 'starter';

    const allSkills = await skillsManager.listAvailableSkills();

    const enrichedSkills = await Promise.all(allSkills.map(async (skill) => {
      const isEligible = await skillsManager.isTenantEligible(tenantId, skill.id, tier);
      return {
        ...skill,
        isEligible,
        requiredTier: ['web-search', 'firecrawl', 'brave-search', 'perplexity'].includes(skill.id) ? 'pro' :
          ['coding-agent', 'custom-hooks'].includes(skill.id) ? 'enterprise' : 'starter'
      };
    }));

    res.json({ success: true, data: enrichedSkills });
  } catch (error: any) {
    logger.error('Route /skills GET error', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
