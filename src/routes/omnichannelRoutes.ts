import express, { Request, Response } from 'express';
import { OpenClawGateway } from '../services/openClawGateway.js';
import { OmnichannelController } from '../controllers/omnichannelController.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════
//  STATUS & HEALTH
// ═══════════════════════════════════════════════════════

router.get('/status', OmnichannelController.getStatus);
router.get('/platforms', OmnichannelController.getSupportedPlatforms);

router.get('/gateway/health', async (_req: Request, res: Response) => {
  try {
    const gateway = OpenClawGateway.getInstance();
    const health = await gateway.getHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    logger.error('Gateway health error', error);
    res.status(500).json({ success: false, error: 'Failed to fetch gateway health' });
  }
});

// ═══════════════════════════════════════════════════════
//  SKILLS
// ═══════════════════════════════════════════════════════

router.get('/skills/report', async (_req: Request, res: Response) => {
  try {
    const gateway = OpenClawGateway.getInstance();
    const report = await gateway.getSkillReport();
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Skills report error', error);
    res.status(500).json({ success: false, error: 'Failed to fetch skills report' });
  }
});

router.get('/skills', OmnichannelController.getSkills);
router.patch('/skills/:id/toggle', OmnichannelController.toggleSkill);

// ═══════════════════════════════════════════════════════
//  AGENTS
// ═══════════════════════════════════════════════════════

router.get('/agents', async (_req: Request, res: Response) => {
  try {
    const gateway = OpenClawGateway.getInstance();
    const result = await gateway.getAgents();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Agents list error', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

router.get('/agents/:id/identity', OmnichannelController.getAgentIdentity);

// ═══════════════════════════════════════════════════════
//  CRON JOBS
// ═══════════════════════════════════════════════════════

router.get('/cron/status', OmnichannelController.getCronStatus);
router.get('/cron/jobs', OmnichannelController.listCronJobs);
router.post('/cron/jobs', OmnichannelController.createCronJob);
router.patch('/cron/jobs/:id/toggle', OmnichannelController.toggleCronJob);
router.post('/cron/jobs/:id/run', OmnichannelController.runCronJob);
router.delete('/cron/jobs/:id', OmnichannelController.deleteCronJob);
router.get('/cron/jobs/:id/runs', OmnichannelController.getCronRuns);

// ═══════════════════════════════════════════════════════
//  USAGE & COST ANALYTICS
// ═══════════════════════════════════════════════════════

router.get('/usage/totals', OmnichannelController.getUsageTotals);
router.get('/usage/daily', OmnichannelController.getUsageDaily);
router.get('/usage/sessions', OmnichannelController.getUsageSessions);
router.get('/usage/sessions/:key/logs', OmnichannelController.getSessionLogs);

// ═══════════════════════════════════════════════════════
//  SESSIONS
// ═══════════════════════════════════════════════════════

router.get('/sessions', OmnichannelController.listSessions);
router.delete('/sessions/:key', OmnichannelController.deleteSession);
router.patch('/sessions/:key', OmnichannelController.patchSession);

// ═══════════════════════════════════════════════════════
//  NODES & DEVICES
// ═══════════════════════════════════════════════════════

router.get('/nodes', OmnichannelController.listNodes);
router.get('/devices', OmnichannelController.listDevices);
router.post('/devices/:id/approve', OmnichannelController.approveDevice);
router.post('/devices/:id/reject', OmnichannelController.rejectDevice);
router.post('/devices/:id/revoke', OmnichannelController.revokeDevice);

// ═══════════════════════════════════════════════════════
//  MESSAGING
// ═══════════════════════════════════════════════════════

router.post('/send', OmnichannelController.sendMessage);

// ═══════════════════════════════════════════════════════
//  LOGS
// ═══════════════════════════════════════════════════════

router.get('/logs', OmnichannelController.getLogs);
router.get('/logs/stream', OmnichannelController.streamLogs);

export default router;
