import express, { Request, Response } from 'express';
import multiTenantService from '../services/multiTenantService.js';
import agentService from '../services/AgentService.js';
import channelService from '../services/ChannelService.js';
import logger from '../utils/logger.js';
import initializeContext from '../lib/context.js';

const router = express.Router();

router.get('/status', (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            message: 'Internal API operational',
            tenantId: req.user?.tenantId
        }
    });
});

/**
 * --- AGENT ROUTES ---
 */

/**
 * List all agents for the authenticated tenant
 */
router.get('/agents', async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await agentService.getAllAgents(tenantId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Create a new agent
 */
router.post('/agents', async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await agentService.createAgent(tenantId, req.body);
        if (result.success) {
            res.json({ success: true, data: result.data });
        } else {
            res.status(400).json({ success: false, error: result.error.message });
        }
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Delete an agent (and cascade)
 */
router.delete('/agents/:id', async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await agentService.deleteAgent(tenantId, req.params.id as string);
        if (result.success) {
            res.json({ success: true, data: { message: 'Agent deleted' } });
        } else {
            res.status(400).json({ success: false, error: result.error.message });
        }
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * --- HIERARCHICAL CHANNEL ROUTES ---
 */

/**
 * Create a new channel under an agent
 */
router.post(['/agents/:agentId/channels', '/channels', '/bots'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const agentId = (req.params.agentId || 'system_default') as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await channelService.createChannel(tenantId, req.body, agentId);

        if (result.success) {
            // Auto-start the channel connection in the background.
            // This triggers WhatsApp QR generation, Telegram bot polling, etc.
            channelService.startChannel(tenantId, result.data.id, agentId, true)
                .catch(err => logger.error(`Auto-start failed for channel ${result.data.id}:`, err));

            res.json({ success: true, data: result.data });
        } else {
            res.status(400).json({ success: false, error: result.error.message });
        }
    } catch (error: any) {
        logger.error('Route /agents/:agentId/channels POST error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * List ALL channels across ALL agents for the authenticated tenant
 */
router.get('/channels/all', async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await channelService.getAllChannelsAcrossAgents(tenantId);

        if (result.success) {
            const channels = result.data.map(chan => ({
                id: chan.id,
                name: chan.name,
                type: chan.type,
                status: chan.status,
                assignedAgentId: chan.assignedAgentId,
                account: chan.phoneNumber || chan.identifier || null
            }));
            res.json({ success: true, data: channels });
        } else {
            logger.error(`getAllChannelsAcrossAgents failed for tenant ${tenantId}:`, result.error);
            res.status(500).json({ success: false, error: result.error?.message });
        }
    } catch (error: any) {
        logger.error('Route /channels/all GET error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * List all channels for a specific agent
 */
router.get('/agents/:agentId/channels', async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const agentId = req.params.agentId as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await channelService.getChannelsForAgent(tenantId, agentId);

        if (result.success) {
            const channels = result.data.map(chan => ({
                id: chan.id,
                name: chan.name,
                type: chan.type,
                status: chan.status,
                assignedAgentId: chan.assignedAgentId
            }));
            res.json({ success: true, data: channels });
        } else {
            logger.error(`getChannelsForAgent failed for tenant ${tenantId}, agent ${agentId}:`, result.error);
            res.status(500).json({ success: false, error: result.error?.message });
        }
    } catch (error: any) {
        logger.error('Route /agents/:agentId/channels GET error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Legacy support for top-level /bots (Mapped to system_default agent)
 */
router.get(['/channels', '/bots'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        // Return channels from system_default agent for legacy UI compatibility
        const result = await channelService.getChannelsForAgent(tenantId, 'system_default');

        if (result.success) {
            const channels = result.data.map(chan => ({
                id: chan.id,
                name: chan.name,
                phoneNumber: chan.phoneNumber || null,
                status: chan.status,
                messageCount: (chan.stats?.messagesSent || 0) + (chan.stats?.messagesReceived || 0),
                lastActiveAt: chan.updatedAt || null,
                assignedAgentId: chan.assignedAgentId || null
            }));
            res.json({ success: true, data: channels });
        } else {
            res.status(500).json({ success: false, error: result.error?.message });
        }
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Get a single channel by ID
 */
router.get(['/agents/:agentId/channels/:id', '/channels/:id'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const agentId = (req.params.agentId || 'system_default') as string;
        const id = req.params.id as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await channelService.getChannel(tenantId, id, agentId);
        if (result.success) {
            res.json({ success: true, data: result.data });
        } else {
            res.status(404).json({ success: false, error: result.error?.message || 'Channel not found' });
        }
    } catch (error: any) {
        logger.error('Route /agents/:agentId/channels/:id GET error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Update a channel
 */
router.patch(['/agents/:agentId/channels/:id', '/channels/:id'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const agentId = (req.params.agentId || 'system_default') as string;
        const id = req.params.id as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await channelService.updateChannel(tenantId, id, req.body, agentId);
        if (result.success) {
            res.json({ success: true, data: result.data });
        } else {
            res.status(400).json({ success: false, error: result.error?.message || 'Update failed' });
        }
    } catch (error: any) {
        logger.error('Route /agents/:agentId/channels/:id PATCH error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Delete a channel
 */
router.delete(['/agents/:agentId/channels/:id', '/channels/:id'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const agentId = (req.params.agentId || 'system_default') as string;
        const id = req.params.id as string;
        const archive = req.query.archive === 'true';

        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await channelService.deleteChannel(tenantId, id, agentId, { archive });
        if (result.success) {
            res.json({ success: true, data: { message: `Channel ${archive ? 'archived' : 'deleted'} successfully` } });
        } else {
            res.status(400).json({ success: false, error: result.error?.message || 'Delete failed' });
        }
    } catch (error: any) {
        logger.error('Route /agents/:agentId/channels/:id DELETE error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Get available channel commands grouped by category
 */
router.get(['/agents/:agentId/commands', '/bots/commands'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const context = await initializeContext();
        const commands = context.commandSystem.getCategorizedCommands();

        res.json({ success: true, data: commands });
    } catch (error: any) {
        logger.error('Route /agents/:agentId/commands GET error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Connect a channel (starts QR generation)
 */
router.post(['/agents/:agentId/channels/:id/connect', '/channels/:id/connect'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const agentId = (req.params.agentId || 'system_default') as string;
        const id = req.params.id as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await channelService.startChannel(tenantId, id, agentId, true);
        if (result.success) {
            res.json({ success: true, data: { message: 'Connection initiated' } });
        } else {
            res.status(400).json({ success: false, error: result.error.message });
        }
    } catch (error: any) {
        logger.error('Route connect POST error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Disconnect a channel
 */
router.post(['/agents/:agentId/channels/:id/disconnect', '/channels/:id/disconnect'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const agentId = (req.params.agentId || 'system_default') as string;
        const id = req.params.id as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const result = await channelService.stopChannel(id, tenantId, agentId);
        if (result.success) {
            res.json({ success: true, data: { message: 'Disconnected successfully' } });
        } else {
            res.status(400).json({ success: false, error: result.error?.message || 'Disconnect failed' });
        }
    } catch (error: any) {
        logger.error('Route disconnect POST error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Get QR code for channel connection
 */
router.get(['/agents/:agentId/channels/:id/qr', '/bots/:botId/qr'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const channelId = (req.params.id || req.params.botId) as string;
        const agentId = (req.params.agentId || 'system_default') as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const qrCode = channelService.getChannelQR(channelId);
        if (qrCode) {
            res.json({ success: true, data: { qrCode } });
        } else {
            res.json({ success: true, data: { qrCode: null, message: 'QR code not yet available, please wait...' } });
        }
    } catch (error: any) {
        logger.error('Route qr GET error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Get Pairing Code for channel
 */
router.post(['/agents/:agentId/channels/:id/pairing-code', '/bots/:botId/pairing-code'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const channelId = (req.params.id || req.params.botId) as string;
        const agentId = (req.params.agentId || 'system_default') as string;
        const { phoneNumber } = req.body;

        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        const result = await channelService.requestPairingCode(tenantId, channelId, phoneNumber, agentId);

        if (result.success) {
            res.json({ success: true, data: { pairingCode: result.data } });
        } else {
            res.status(400).json({ success: false, error: result.error?.message || 'Failed to get pairing code' });
        }
    } catch (error: any) {
        logger.error('Route pairing-code POST error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Move a channel between agents
 */
router.post('/agents/:agentId/channels/:id/move', async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const currentAgentId = req.params.agentId;
        const channelId = req.params.id;
        const { targetAgentId } = req.body;

        if (!tenantId) return res.status(401).json({ success: false, error: 'Authentication required' });
        if (!targetAgentId) return res.status(400).json({ success: false, error: 'Target Agent ID is required' });

        const result = await channelService.moveChannel(tenantId, channelId as string, currentAgentId as string, targetAgentId as string);
        if (result.success) {
            res.json({ success: true, data: { message: 'Channel moved successfully' } });
        } else {
            res.status(400).json({ success: false, error: result.error?.message || 'Move failed' });
        }
    } catch (error: any) {
        logger.error('Route /channels/:id/move POST error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Get channel status
 */
router.get(['/agents/:agentId/channels/:id/status', '/bots/:botId/status'], async (req: Request, res: Response) => {
    try {
        const tenantId = req.user?.tenantId as string;
        const channelId = (req.params.id || req.params.botId) as string;
        const agentId = (req.params.agentId || 'system_default') as string;
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const channelResult = await channelService.getChannel(tenantId, channelId, agentId);
        if (!channelResult.success) return res.status(404).json({ success: false, error: 'Channel not found' });

        const channel = channelResult.data;
        const hasQR = !!channelService.getChannelQR(channelId);

        res.json({
            success: true,
            data: {
                id: channelId,
                status: channel.status,
                isActive: channel.status === 'connected' || channel.status === 'connecting',
                hasQR
            }
        });
    } catch (error: any) {
        logger.error('Route status GET error', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;
