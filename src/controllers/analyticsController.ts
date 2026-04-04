import { Request, Response } from 'express';
import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';
import monitoringService from '../services/monitoring.js';
import { channelService } from '../services/ChannelService.js';

export class AnalyticsController {
    /**
     * Get dashboard statistics
     */
    static async getDashboardStats(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            // 1. Fetch Channels for this tenant (Modern Replacement for Bots)
            const channelsResult = await channelService.getAllChannelsAcrossAgents(tenantId);
            const bots = channelsResult.success ? channelsResult.data : [];

            const totalBots = bots.length;
            const activeBots = bots.filter(b => b.status === 'connected' || b.status === 'connecting').length;

            // 2. Calculate Message Stats
            let totalMessages = 0;
            bots.forEach(bot => {
                if (bot.stats && typeof bot.stats === 'object') {
                    totalMessages += (bot.stats.messagesSent || 0) + (bot.stats.messagesReceived || 0);
                }
            });

            // 3. Fetch Contacts Count
            const contactsQuery = db.collection('tenants')
                .doc(tenantId)
                .collection('contacts');

            const contactsSnapshot = await contactsQuery.count().get();
            const totalContacts = contactsSnapshot.data().count;

            const metrics = await monitoringService.getMetrics();

            // 4. Fetch Tenant usage from root
            const tenantRef = db.collection('tenants').doc(tenantId);
            const tenantDoc = await tenantRef.get();
            const tenantData = tenantDoc.data() || {};
            const plan = (tenantData.plan || 'starter') as string;
            const monthlyUsage = tenantData.stats?.totalMessagesSent || 0;

            const { usageGuard } = await import('../services/UsageGuard.js');
            const monthlyLimit = usageGuard.getMonthlyLimit(plan as any);

            res.json({
                success: true,
                data: {
                    totalBots,
                    activeBots,
                    totalMessages,
                    totalContacts,
                    monthlyUsage,
                    monthlyLimit,
                    plan,
                    systemHealth: metrics.responseTimes.avg < 1000 ? 'Healthy' : 'Degraded',
                    metrics: metrics.systemHealth
                }
            });

        } catch (error: any) {
            logger.error('AnalyticsController.getDashboardStats error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Get message analytics (using real daily aggregates)
     */
    static async getMessageAnalytics(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const days = parseInt(req.query.days as string) || 7;

            // Fetch real analytics data from the analytics collection
            const analyticsSnapshot = await db.collection('tenants')
                .doc(tenantId)
                .collection('analytics')
                .orderBy('date', 'desc')
                .limit(days)
                .get();

            if (analyticsSnapshot.empty) {
                // If no analytics data exists yet, return empty structure
                const result = [];
                const end = new Date();
                for (let i = days - 1; i >= 0; i--) {
                    const date = new Date(end);
                    date.setDate(date.getDate() - i);
                    result.push({
                        date: date.toISOString().split('T')[0],
                        sent: 0,
                        received: 0,
                        errors: 0
                    });
                }
                return res.json({ success: true, data: result });
            }

            // Map analytics data
            const analytics = analyticsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    date: data.date,
                    sent: data.sent || 0,
                    received: data.received || 0,
                    errors: data.errors || 0
                };
            });

            res.json({
                success: true,
                data: analytics.reverse() // Return in chronological order
            });
        } catch (error: any) {
            logger.error('AnalyticsController.getMessageAnalytics error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    /**
     * Get detailed usage analytics for charts
     */
    static async getUsageAnalytics(req: Request, res: Response) {
        try {
            const tenantId = req.user?.tenantId;
            const days = parseInt(req.query.days as string) || 30;

            if (!tenantId) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const metricsSnapshot = await db.collection('tenants')
                .doc(tenantId)
                .collection('analytics')
                .orderBy('date', 'desc')
                .limit(days)
                .get();

            const metrics = metricsSnapshot.docs.map(doc => doc.data());

            res.json({
                success: true,
                data: metrics.reverse() // Chronological order for charts
            });

        } catch (error: any) {
            logger.error('AnalyticsController.getUsageAnalytics error', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}
