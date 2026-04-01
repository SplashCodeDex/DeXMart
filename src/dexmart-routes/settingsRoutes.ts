import express from 'express';

import { updateProfile } from '../controllers/authController.js';

const router = express.Router();

/**
 * PATCH /api/settings/profile
 * Update the authenticated user's display name.
 */
router.patch('/profile', updateProfile);

export default router;
