import { Router } from 'express';
import { FlowController } from '../controllers/flowController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * @route   GET /api/flows
 * @desc    List all flows for a tenant
 * @access  Private
 */
router.get('/', authenticateToken, FlowController.listFlows);

/**
 * @route   POST /api/flows
 * @desc    Save (Create/Update) a flow
 * @access  Private
 */
router.post('/', authenticateToken, FlowController.saveFlow);

/**
 * @route   GET /api/flows/:id
 * @desc    Get a specific flow
 * @access  Private
 */
router.get('/:id', authenticateToken, FlowController.getFlow);

/**
 * @route   DELETE /api/flows/:id
 * @desc    Delete a flow
 * @access  Private
 */
router.delete('/:id', authenticateToken, FlowController.deleteFlow);

export default router;
