import { Router } from 'express';
import { handleClientLog } from '../controllers/logsController.js';

const router = Router();

// POST /api/logs/client
// Uses the handleClientLog controller to parse and store frontend errors
router.post('/client', handleClientLog);

export default router;
