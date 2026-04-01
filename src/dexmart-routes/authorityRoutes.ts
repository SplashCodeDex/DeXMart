import express from 'express';
import { AuthorityController } from '../controllers/authorityController.js';

const router = express.Router();

/**
 * ═══════════════════════════════════════════════════════
 *  SYSTEM AUTHORITY & GATING
 * ═══════════════════════════════════════════════════════
 */

router.get('/capabilities', AuthorityController.getCapabilities);

export default router;
