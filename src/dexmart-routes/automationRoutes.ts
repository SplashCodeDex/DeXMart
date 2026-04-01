import express from 'express';
import { AutomationController } from '../controllers/automationController.js';

const router = express.Router();

router.get('/', AutomationController.listAutomations);
router.post('/', AutomationController.createAutomation);
router.patch('/:id/toggle', AutomationController.toggleAutomation);

export default router;
