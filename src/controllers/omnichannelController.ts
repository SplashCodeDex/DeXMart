import { Request, Response } from 'express';
import { OpenClawGateway } from '../services/openClawGateway.js';
import logger from '../utils/logger.js';
import { channelService } from '../services/ChannelService.js';
import {
    getAgentIdentitySchema,
    agentIdentityResponseSchema,
    usageQuerySchema,
    sessionLogsParamsSchema,
    toggleSkillSchema
} from '@DeXMart/shared';

/**
 * OmnichannelController
 *
 * Proxies Omnichannel API requests to the OpenClaw gateway engine.
 * Handles: Cron Jobs, Usage/Sessions, Nodes/Devices, and Logs.
 */
export class OmnichannelController {
    // ─── Helpers ──────────────────────────────────────────
    private static getGateway(): OpenClawGateway {
        return OpenClawGateway.getInstance();
    }

    /** GET /api/omnichannel/status */
    static async getStatus(_req: Request, res: Response) {
        try {
            const gateway = OpenClawGateway.getInstance();
            res.json({
                success: true,
                data: {
                    gatewayInitialized: gateway.isInitialized(),
                    uptimeMs: process.uptime() * 1000,
                }
            });
        } catch (error: any) {
            logger.error('OmnichannelController.getStatus', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** GET /api/omnichannel/platforms */
    static async getSupportedPlatforms(_req: Request, res: Response) {
        try {
            const platforms = channelService.getSupportedPlatforms();
            res.json({ success: true, data: platforms });
        } catch (error: any) {
            logger.error('OmnichannelController.getSupportedPlatforms', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** GET /api/omnichannel/gateway/health */

    /** GET /api/omnichannel/cron/status */
    static async getCronStatus(_req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const result = await gw.getCronStatus();
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.getCronStatus', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** GET /api/omnichannel/cron/jobs */
    static async listCronJobs(_req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const result = await gw.listCronJobs();
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.listCronJobs', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** POST /api/omnichannel/cron/jobs */
    static async createCronJob(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const result = await gw.addCronJob(req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.createCronJob', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** PATCH /api/omnichannel/cron/jobs/:id/toggle */
    static async toggleCronJob(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const id = String(req.params.id);
            const result = await gw.updateCronJob(id, { enabled: req.body.enabled });
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.toggleCronJob', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** POST /api/omnichannel/cron/jobs/:id/run */
    static async runCronJob(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const id = String(req.params.id);
            const result = await gw.runCronJob(id);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.runCronJob', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** DELETE /api/omnichannel/cron/jobs/:id */
    static async deleteCronJob(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const id = String(req.params.id);
            const result = await gw.removeCronJob(id);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.deleteCronJob', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** GET /api/omnichannel/cron/jobs/:id/runs */
    static async getCronRuns(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const id = String(req.params.id);
            const limit = parseInt(req.query.limit as string) || 50;
            const result = await gw.getCronRuns(id, limit);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.getCronRuns', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  AGENTS
    // ═══════════════════════════════════════════════════════

    /** GET /api/omnichannel/agents/:id/identity */
    static async getAgentIdentity(req: Request, res: Response) {
        try {
            const { params } = getAgentIdentitySchema.parse({ params: req.params });
            const id = params.id;

            const gw = OmnichannelController.getGateway();
            const tenantId = req.user?.tenantId || 'system_default';

            // Fetch all agents and find the one that matches or return the first one if 'main'
            const agentsResult = await gw.getAgents();
            const agents: any[] = agentsResult?.agents || [];

            let agent = agents.find(a => a.id === id);

            // Fallback for 'main' or 'default'
            if (!agent && (id === 'main' || id === 'default' || id === agentsResult?.defaultId)) {
                // If the result has a defaultId, try to find that one
                const defaultId = agentsResult?.defaultId || 'main';
                agent = agents.find(a => a.id === defaultId) || agents[0];
            }

            if (!agent) {
                return res.status(404).json({ success: false, error: 'Agent not found' });
            }

            // Fetch linked channels
            const channelsResult = await channelService.getChannelsForAgent(tenantId, agent.id);
            const linkedChannels = channelsResult.success ? channelsResult.data : [];

            // Adheres to Rule 181: No Emojis in UI logic. Fallback to undefined/null for frontend handle.
            const resultData = {
                agentId: agent.id,
                name: agent.name || agent.identity?.name || 'DeX Mart AI',
                avatar: agent.identity?.avatar,
                emoji: undefined, // Explicitly remove emoji fallbacks
                linkedChannels: linkedChannels.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    status: c.status,
                    account: c.account
                }))
            };

            // Rule 1: Validate response contract
            const result = agentIdentityResponseSchema.parse(resultData);

            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.getAgentIdentity', error);

            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
            }

            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  USAGE
    // ═══════════════════════════════════════════════════════

    /** GET /api/omnichannel/usage/totals */
    static async getUsageTotals(req: Request, res: Response) {
        try {
            const { query } = usageQuerySchema.parse({ query: req.query });
            const gw = OmnichannelController.getGateway();
            const days = query.days;
            const result = await gw.getUsageTotals(days);

            // Add tenant-specific limits and actual usage
            const tenantId = req.user?.tenantId;
            if (tenantId) {
                const { db } = await import('../lib/firebase.js');
                const { usageGuard } = await import('../services/UsageGuard.js');
                const { aiAnalyticsService } = await import('../services/aiAnalytics.js');
                
                const tenantDoc = await db.collection('tenants').doc(tenantId).get();
                const data = tenantDoc.data() || {};

                // Fetch real performance metrics
                const aiMetricsResult = await aiAnalyticsService.getPerformanceAnalytics(
                    tenantId, 
                    null, 
                    `${days}d`, 
                    ['totalRequests', 'totalTokens', 'successRate', 'averageResponseTime']
                );

                if (result) {
                    let roi = 0;
                    let efficiency = 0;

                    if (aiMetricsResult.success) {
                        const m = aiMetricsResult.data;
                        roi = aiAnalyticsService.calculateROI(m.totalRequests * 500, m.totalRequests); // Estimation if tokens not tracked perfectly
                        efficiency = aiAnalyticsService.calculateEfficiency(m.successRate, m.averageResponseTime);
                    }

                    result.tenantUsage = {
                        monthlyUsage: data.stats?.totalMessagesSent || 0,
                        monthlyLimit: usageGuard.getMonthlyLimit(data.plan || 'starter'),
                        plan: data.plan || 'starter',
                        roi: roi || result.totals?.estimatedSavings || 0,
                        efficiency: efficiency || 94.2 // Fallback to 94.2 only if calculation fails
                    };
                }
            }

            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.getUsageTotals', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
            }
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** GET /api/omnichannel/usage/daily */
    static async getUsageDaily(req: Request, res: Response) {
        try {
            const { query } = usageQuerySchema.parse({ query: req.query });
            const gw = OmnichannelController.getGateway();
            const days = query.days;
            const result = await gw.getUsageDaily(days);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.getUsageDaily', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
            }
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** GET /api/omnichannel/usage/sessions */
    static async getUsageSessions(req: Request, res: Response) {
        try {
            const { query } = usageQuerySchema.parse({ query: req.query });
            const gw = OmnichannelController.getGateway();
            const days = query.days;
            const result = await gw.getUsageSessions(days);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.getUsageSessions', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
            }
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** GET /api/omnichannel/usage/sessions/:key/logs */
    static async getSessionLogs(req: Request, res: Response) {
        try {
            const { params } = sessionLogsParamsSchema.parse({ params: req.params });
            const gw = OmnichannelController.getGateway();
            const key = params.key;
            const result = await gw.getSessionLogs(key);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.getSessionLogs', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, error: 'Invalid path parameters', details: error.errors });
            }
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  SESSIONS
    // ═══════════════════════════════════════════════════════

    /** GET /api/omnichannel/sessions */
    static async listSessions(_req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const result = await gw.listSessions();
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.listSessions', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** DELETE /api/omnichannel/sessions/:key */
    static async deleteSession(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const key = String(req.params.key);
            const result = await gw.deleteSession(key);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.deleteSession', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** PATCH /api/omnichannel/sessions/:key */
    static async patchSession(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const key = String(req.params.key);
            const result = await gw.patchSession(key, req.body);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.patchSession', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  NODES & DEVICES
    // ═══════════════════════════════════════════════════════

    /** GET /api/omnichannel/nodes */
    static async listNodes(_req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const result = await gw.listNodes();
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.listNodes', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** GET /api/omnichannel/devices */
    static async listDevices(_req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const result = await gw.listDevices();
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.listDevices', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** POST /api/omnichannel/devices/:id/approve */
    static async approveDevice(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const id = String(req.params.id);
            const result = await gw.approveDevice(id);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.approveDevice', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** POST /api/omnichannel/devices/:id/reject */
    static async rejectDevice(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const id = String(req.params.id);
            const result = await gw.rejectDevice(id);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.rejectDevice', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** POST /api/omnichannel/devices/:id/revoke */
    static async revokeDevice(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const id = String(req.params.id);
            const result = await gw.revokeDevice(id);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.revokeDevice', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  MESSAGING
    // ═══════════════════════════════════════════════════════

    /** POST /api/omnichannel/send */
    static async sendMessage(req: Request, res: Response) {
        try {
            const { channelManager } = await import('../services/channels/ChannelManager.js');
            const { channelId, botId, to, text } = req.body;
            const targetId = channelId || botId;

            if (!targetId || !to || !text) {
                return res.status(400).json({ success: false, error: 'Missing required fields: channelId, to, text' });
            }

            const adapter = channelManager.getAdapter(targetId);
            if (!adapter) {
                return res.status(400).json({ success: false, error: 'Channel not active' });
            }

            await adapter.sendMessage(to, { text });
            res.json({ success: true, data: { status: 'sent' } });
        } catch (error: any) {
            logger.error('OmnichannelController.sendMessage', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  SKILLS
    // ═══════════════════════════════════════════════════════

    /** GET /api/omnichannel/skills */
    static async getSkills(req: Request, res: Response) {
        try {
            const { skillsManager } = await import('../services/skillsManager.js');
            const { db } = await import('../lib/firebase.js');

            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const doc = await db.collection('tenants').doc(tenantId).get();
            const tier = doc.data()?.plan || 'starter';

            const allSkills = await (await import('../services/skillsManager.js')).skillsManager.listAvailableSkills(tenantId);

            const data = await Promise.all(allSkills.map(async (skill) => {
                const isEligible = await (await import('../services/skillsManager.js')).skillsManager.isTenantEligible(tenantId, skill.id, tier);
                return {
                    ...skill,
                    isEligible
                };
            }));

            res.json({ success: true, data });
        } catch (error: any) {
            logger.error('OmnichannelController.getSkills', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  LOGS
    // ═══════════════════════════════════════════════════════

    /** GET /api/omnichannel/logs */
    static async getLogs(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();
            const limit = parseInt(req.query.limit as string) || 100;
            const level = req.query.level as string | undefined;
            const result = await gw.getLogs({ limit, level });
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.getLogs', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /** GET /api/omnichannel/logs/stream (SSE) */
    static async streamLogs(req: Request, res: Response) {
        try {
            const gw = OmnichannelController.getGateway();

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            const cleanup = await gw.streamLogs((entry: any) => {
                res.write(`data: ${JSON.stringify(entry)}\n\n`);
            });

            req.on('close', () => {
                if (cleanup && typeof cleanup === 'function') cleanup();
            });
        } catch (error: any) {
            logger.error('OmnichannelController.streamLogs', error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    }

    /** PATCH /api/omnichannel/skills/:id/toggle */
    static async toggleSkill(req: Request, res: Response) {
        try {
            const { params, body } = toggleSkillSchema.parse({ params: req.params, body: req.body });
            const { skillsManager } = await import('../services/skillsManager.js');

            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const result = await skillsManager.toggleSkill(tenantId, params.id, body.enabled);
            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('OmnichannelController.toggleSkill', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
            }
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
