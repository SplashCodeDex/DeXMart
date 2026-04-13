import { Worker, Job } from 'bullmq';
import { Campaign, CampaignStatus, MessageTemplate, Contact } from '../types/contracts.js';
import { firebaseService } from '../persistence/firebase.js';
import { channelService } from '../services/ChannelService.js';
import jobQueueService from '../services/jobQueue.js';
import { groupService } from '../services/groupService.js';
import { webhookService } from '../services/webhookService.js';
import { socketService } from '../services/socketService.js';
import { TemplateService } from '../services/templateService.js';
import { AIUtilityService as GeminiAI } from '../services/ai-utility.js';
import { antiBanService } from '../services/antiBanService.js';
import logger from '../utils/logger.js';
import moment from 'moment-timezone';
import configManager from '../dexmart-config/ConfigManager.js';

/**
 * Gaussian Random Utility
 * Generates a number with a normal distribution around a mean.
 */
function gaussianRandom(min: number, max: number, skew: number = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

    num = num / 10.0 + 0.5; // Translate to 0 -> 1
    if (num > 1 || num < 0) num = gaussianRandom(min, max, skew); // resample between 0 and 1 if out of range
    num = Math.pow(num, skew); // Stretch to fill range
    num *= max - min; // stretch to fill range
    num += min; // offset to min
    return num;
}

const redisOptions = {
    host: configManager.config.redis.host,
    port: configManager.config.redis.port,
    password: configManager.config.redis.password,
    maxRetriesPerRequest: null,
};

interface CampaignJobData {
    tenantId: string;
    campaign: Campaign;
}

class CampaignWorker {
    private worker: any;

    constructor() {
        this.worker = new Worker(
            'campaigns',
            async (job: Job<CampaignJobData>) => {
                await this.processCampaign(job);
            },
            {
                connection: redisOptions,
                concurrency: 2,
                limiter: {
                    max: 10,
                    duration: 1000
                }
            } as any
        );

        this.worker.on('completed', (job: Job<CampaignJobData>) => {
            logger.info(`Campaign Job ${job.id} completed`);
        });

        this.worker.on('failed', (job: Job<CampaignJobData> | undefined, err: Error) => {
            logger.error(`Campaign Job ${job?.id} failed:`, err);
        });

        logger.info('CampaignWorker initialized with Omnichannel Adapter + Anti-Ban Engine');
    }

    public async processCampaign(job: Job<CampaignJobData>): Promise<void> {
        const { tenantId, campaign } = job.data;
        const { id } = campaign;

        const currentCampaign = await firebaseService.getDoc<'users/{userId}/campaigns'>('campaigns', id, tenantId);
        if (!currentCampaign) throw new Error('Campaign not found');

        if (currentCampaign.status === 'completed' || currentCampaign.status === 'cancelled') return;
        if (currentCampaign.status === 'paused') {
            logger.info(`Campaign ${id} is paused. Job processed.`);
            return;
        }

        const templateResult = await TemplateService.getInstance().getTemplate(tenantId, currentCampaign.templateId);
        if (!templateResult.success || !templateResult.data) throw new Error('Template not found');
        const template = templateResult.data;

        const targets = await this.loadTargets(tenantId, currentCampaign.audience);
        if (targets.length === 0) {
            await this.finalizeCampaign(tenantId, id, 0, 0, 0);
            return;
        }

        if (!currentCampaign.stats.total) {
            await this.updateCampaignStats(tenantId, id, { total: targets.length, pending: targets.length });
        }

        if (currentCampaign.antiBan.workingHoursEnabled) {
            const tz = currentCampaign.antiBan.timezone || 'UTC';
            const now = moment().tz(tz);
            const start = moment.tz(currentCampaign.antiBan.workingHoursStart, 'HH:mm', tz);
            const end = moment.tz(currentCampaign.antiBan.workingHoursEnd, 'HH:mm', tz);

            if (now.isBefore(start) || now.isAfter(end)) {
                logger.info(`Campaign ${id} outside working hours in ${tz}. Pausing...`);
                await this.updateCampaignStatus(tenantId, id, 'paused');
                return;
            }
        }

        const activeChannelIds = this.getAvailableChannelIds(tenantId, currentCampaign.distribution);
        if (activeChannelIds.length === 0) {
            logger.warn(`No active channels for campaign ${id}. Job will retry.`);
            throw new Error('No active channels available');
        }

        let sent = currentCampaign.stats.sent || 0;
        let failed = currentCampaign.stats.failed || 0;
        const total = targets.length;

        if (sent + failed >= total) {
            await this.finalizeCampaign(tenantId, id, sent, failed, total);
            return;
        }

        await this.updateCampaignStatus(tenantId, id, 'sending');

        const segmentSize = currentCampaign.antiBan.batchSize > 0 ? currentCampaign.antiBan.batchSize : 50;
        const endIndex = Math.min(sent + failed + segmentSize, total);

        for (let i = sent + failed; i < endIndex; i++) {
            const contact = targets[i];

            if (i % 5 === 0) {
                const live = await firebaseService.getDoc<'users/{userId}/campaigns'>('campaigns', id, tenantId);
                if (live?.status === 'paused' || live?.status === 'cancelled') return;
            }

            const channelId = activeChannelIds[i % activeChannelIds.length];

            try {
                const content = await this.prepareMessage(tenantId, template, contact, currentCampaign.antiBan.aiSpinning);

                // ─── ANTI-BAN: CONTENT RULE CHECK ────────────────────
                // Hash the rendered message body. If we see too many identical
                // messages in this campaign, pause it to prevent WhatsApp flagging.
                const shouldPause = await antiBanService.checkContentHash(tenantId, id, content);
                if (shouldPause) {
                    await antiBanService.triggerCooldown(
                        tenantId,
                        id,
                        `Content similarity threshold exceeded. ${sent} identical messages detected. ` +
                        `Enable AI Spinning in campaign settings to vary message copy automatically.`,
                        currentCampaign.antiBan.autoResume
                    );
                    // Save progress before exiting
                    await this.updateCampaignStats(tenantId, id, { sent, failed, pending: total - (sent + failed) });
                    return;
                }

                // Enqueue to anti-ban queue worker (replaces deprecated adapter.sendMessage())
                await jobQueueService.addJob('whatsapp-outbound', 'campaign-send', {
                    tenantId,
                    channelId,
                    jid: contact.phone,
                    message: content,
                });
                sent++;

                if (i % 5 === 0 || i === endIndex - 1) {
                    await this.updateCampaignStats(tenantId, id, { sent, failed, pending: total - (sent + failed) });
                    socketService.emitProgress(tenantId, id, { sent, failed, total, status: 'sending' });
                }

                if (i < endIndex - 1) {
                    const delay = Math.floor(gaussianRandom(currentCampaign.antiBan.minDelay, currentCampaign.antiBan.maxDelay) * 1000);
                    await new Promise(r => setTimeout(r, delay));
                }

            } catch (err) {
                failed++;
                logger.error(`Campaign ${id} message error for ${contact.phone}:`, err);
            }
        }

        if (sent + failed < total) {
            const delayTime = currentCampaign.antiBan.batchSize > 0
                ? Math.floor(gaussianRandom(currentCampaign.antiBan.batchPauseMin, currentCampaign.antiBan.batchPauseMax) * 60 * 1000)
                : Math.floor(gaussianRandom(currentCampaign.antiBan.minDelay, currentCampaign.antiBan.maxDelay) * 1000);

            await this.worker.queue.add('process-campaign', { tenantId, campaign: currentCampaign }, { delay: delayTime });
        } else {
            await this.finalizeCampaign(tenantId, id, sent, failed, total);
        }
    }

    private async loadTargets(tenantId: string, audience: Campaign['audience']): Promise<Contact[]> {
        if (audience.type === 'audience') {
            const aud = await firebaseService.getDoc<'users/{userId}/audiences'>('audiences', audience.targetId, tenantId);
            if (!aud) return [];
            const allContacts = await firebaseService.getCollection<'users/{userId}/contacts'>('contacts', tenantId);
            if (aud.filters && aud.filters.tags) {
                return allContacts.filter(c => c.tags.some(t => aud.filters.tags.includes(t)));
            }
            return allContacts;
        }

        if (audience.type === 'groups') {
            const activeChannelIds = this.getAvailableChannelIds(tenantId, { type: 'pool' } as any);

            if (audience.targetId === 'all') {
                let groups = await firebaseService.getCollection<'users/{userId}/groups'>('groups', tenantId);

                if (groups.length === 0 && activeChannelIds.length > 0) {
                    try {
                        const { getWhatsAppRuntime } = await import('../../extensions/whatsapp/src/runtime.js');
                        const socket = getWhatsAppRuntime().channel.whatsapp.getActiveWebListener();
                        if (socket) {
                            await groupService.syncAllGroups(socket as any);
                            groups = await firebaseService.getCollection<'users/{userId}/groups'>('groups', tenantId);
                        }
                    } catch { /* runtime not yet initialised */ }
                }

                return groups.map(g => ({
                    id: g.id,
                    tenantId,
                    name: (g as any).subject || (g as any).name || 'Unknown Group',
                    phone: g.id,
                    tags: [],
                    status: 'active' as const,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as Contact));
            } else {
                let group = await firebaseService.getDoc<'users/{userId}/groups'>('groups', audience.targetId, tenantId);

                if (!group && activeChannelIds.length > 0) {
                    try {
                        const { getWhatsAppRuntime } = await import('../../extensions/whatsapp/src/runtime.js');
                        const socket = getWhatsAppRuntime().channel.whatsapp.getActiveWebListener();
                        if (socket) {
                            await groupService.syncGroup(socket as any, audience.targetId);
                            group = await firebaseService.getDoc<'users/{userId}/groups'>('groups', audience.targetId, tenantId);
                        }
                    } catch { /* runtime not yet initialised */ }
                }

                if (!group) return [];
                return [{
                    id: group.id,
                    tenantId,
                    name: (group as any).subject || (group as any).name || 'Unknown Group',
                    phone: group.id,
                    tags: [],
                    status: 'active' as const,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as Contact];
            }
        }

        if (audience.type === 'contacts') {
            return await firebaseService.getCollection<'users/{userId}/contacts'>('contacts', tenantId);
        }

        return [];
    }

    private getAvailableChannelIds(tenantId: string, distribution: Campaign['distribution']): string[] {
        // Use native ChannelService runtime snapshot instead of deprecated channelManager singleton.
        // getActiveChannelIds() returns running channel type IDs; for campaign routing we use
        // channelService.getActiveChannelIds() as a best-effort active check.
        const channelId = distribution.channelId || (distribution as any).botId;
        if (distribution.type === 'single' && channelId) {
            const active = channelService.getActiveChannelIds();
            return active.some(c => c.id === channelId) ? [channelId] : [channelId]; // always attempt single
        }
        return channelService.getActiveChannelIds().map(c => c.id);
    }

    private async prepareMessage(tenantId: string, template: MessageTemplate, contact: Contact, spin: boolean): Promise<string> {
        let content = template.content;
        const vars = { name: contact.name, phone: contact.phone, email: contact.email, ...(contact.attributes || {}) };

        for (const [key, value] of Object.entries(vars)) {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        }

        if (spin) {
            const spinResult = await GeminiAI.spinMessage(content, tenantId);
            if (spinResult.success && spinResult.data) content = spinResult.data;
        }

        return content;
    }

    private async updateCampaignStats(tenantId: string, campaignId: string, stats: Partial<Campaign['stats']>): Promise<void> {
        await firebaseService.setDoc<'users/{userId}/campaigns'>('campaigns', campaignId, { stats: stats as any, updatedAt: new Date() }, tenantId, true);
    }

    private async updateCampaignStatus(tenantId: string, campaignId: string, status: CampaignStatus): Promise<void> {
        await firebaseService.setDoc<'users/{userId}/campaigns'>('campaigns', campaignId, { status, updatedAt: new Date() }, tenantId, true);
    }

    private static instance: CampaignWorker;

    public static getInstance() {
        if (!CampaignWorker.instance) {
            CampaignWorker.instance = new CampaignWorker();
        }
        return CampaignWorker.instance;
    }

    private async finalizeCampaign(tenantId: string, id: string, sent: number, failed: number, total: number) {
        await firebaseService.setDoc<'users/{userId}/campaigns'>('campaigns', id, {
            status: 'completed',
            stats: { sent, failed, pending: 0, total },
            updatedAt: new Date()
        }, tenantId, true);

        await webhookService.dispatch(tenantId, 'campaign.completed', { campaignId: id, stats: { sent, failed, total } });
    }
}

export const getCampaignWorker = () => {
    return CampaignWorker.getInstance();
};
