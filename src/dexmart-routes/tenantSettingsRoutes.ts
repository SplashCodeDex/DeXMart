import express from 'express';
import { TenantSettingsController } from '../controllers/tenantSettingsController.js';

const router = express.Router();

/**
 * GET /api/tenant/settings
 * Retrieves the current tenant's settings
 */
router.get('/settings', TenantSettingsController.getSettings);

/**
 * PATCH /api/tenant/settings
 * Updates the current tenant's settings
 */
router.patch('/settings', TenantSettingsController.updateSettings);

export default router;
