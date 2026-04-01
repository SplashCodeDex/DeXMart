import { firebaseService } from './FirebaseService.js';
import { queueService } from './queueService.js';
import { Campaign, CampaignSchema, CampaignStatus, Result } from '../types/contracts.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

export class CampaignService {
    private static instance: CampaignService;

    private constructor() {}

    public static getInstance(): CampaignService {
        if (!CampaignService.instance) {
            CampaignService.instance = new CampaignService();
        }
        return CampaignService.instance;
    }

    /**
     * Create a new campaign for a tenant
     */
    async createCampaign(tenantId: string, data: Omit<Campaign, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'stats' | 'status'>): Promise<Result<Campaign>> {
        try {
            const campaignId = `camp_${crypto.randomUUID()}`;
            const campaign: Campaign = {
                ...data,
                id: campaignId,
                tenantId,
                stats: {
                    total: 0, // Will be calculated by the worker when starting
                    sent: 0,
                    failed: 0,
                    pending: 0
                },
                status: 'draft' as CampaignStatus,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const validation = CampaignSchema.safeParse(campaign);
            if (!validation.success) {
                return { success: false, error: new Error(validation.error.issues[0].message) };
            }

            await firebaseService.setDoc<'tenants/{tenantId}/campaigns'>('campaigns', campaignId, campaign, tenantId);

            // If immediate, start it
            if (campaign.schedule.type === 'immediate') {
                await this.startCampaign(tenantId, campaignId);
            }

            return { success: true, data: campaign };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`CampaignService.createCampaign error [${tenantId}]:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Get all campaigns for a tenant
     */
    async getCampaigns(tenantId: string): Promise<Result<Campaign[]>> {
        try {
            const campaigns = await firebaseService.getCollection<'tenants/{tenantId}/campaigns'>('campaigns', tenantId);
            return { success: true, data: campaigns };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`CampaignService.getCampaigns error [${tenantId}]:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Start a campaign execution
     */
    async startCampaign(tenantId: string, campaignId: string): Promise<Result<void>> {
        try {
            const campaign = await firebaseService.getDoc<'tenants/{tenantId}/campaigns'>('campaigns', campaignId, tenantId);
            if (!campaign) return { success: false, error: new Error('Campaign not found') };

            if (campaign.status === 'sending' || campaign.status === 'completed') {
                return { success: false, error: new Error(`Campaign is already ${campaign.status}`) };
            }

            // Update status to pending
            await this.updateCampaignStatus(tenantId, campaignId, 'pending');

            // Calculate delay if scheduled
            let delay = 0;
            if (campaign.schedule.type === 'scheduled' && campaign.schedule.scheduledAt) {
                const scheduledTime = new Date(campaign.schedule.scheduledAt).getTime();
                delay = Math.max(0, scheduledTime - Date.now());
            }

            // Add to Queue
            await queueService.addCampaignJob(tenantId, { ...campaign, status: 'pending' }, { delay });

            return { success: true, data: undefined };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`CampaignService.startCampaign error [${tenantId}/${campaignId}]:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Resume a campaign
     */
    async resumeCampaign(tenantId: string, campaignId: string): Promise<Result<void>> {
        try {
            const campaign = await firebaseService.getDoc<'tenants/{tenantId}/campaigns'>('campaigns', campaignId, tenantId);
            if (!campaign) return { success: false, error: new Error('Campaign not found') };

            if (campaign.status !== 'paused') {
                return { success: false, error: new Error(`Campaign is not paused (current status: ${campaign.status})`) };
            }

            // Update status to pending (or sending if immediate)
            await this.updateCampaignStatus(tenantId, campaignId, 'pending');

            // Re-add to queue (or signal worker)
            // Note: If campaign was partially done, worker should handle "resume" logic by checking stats/state.
            // For now, we just add it back to queue, assuming worker is idempotent or handles processed items.
            // But since queue might be empty, we re-add.
            await queueService.addCampaignJob(tenantId, { ...campaign, status: 'pending' }, { delay: 0 });

            return { success: true, data: undefined };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`CampaignService.resumeCampaign error [${tenantId}/${campaignId}]:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Pause a campaign execution
     */
    async pauseCampaign(tenantId: string, campaignId: string): Promise<Result<void>> {
        try {
            await this.updateCampaignStatus(tenantId, campaignId, 'paused');
            return { success: true, data: undefined };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`CampaignService.pauseCampaign error [${tenantId}/${campaignId}]:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Duplicate a campaign
     */
    async duplicateCampaign(tenantId: string, campaignId: string): Promise<Result<Campaign>> {
        try {
            const campaign = await firebaseService.getDoc<'tenants/{tenantId}/campaigns'>('campaigns', campaignId, tenantId);
            if (!campaign) return { success: false, error: new Error('Campaign not found') };

            const { id, createdAt, updatedAt, stats, status, ...data } = campaign;
            const newCampaignData: Omit<Campaign, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'stats' | 'status'> = {
                ...data,
                name: `${campaign.name} (Copy)`
            };

            return await this.createCampaign(tenantId, newCampaignData);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`CampaignService.duplicateCampaign error [${tenantId}/${campaignId}]:`, err);
            return { success: false, error: err };
        }
    }

    private async updateCampaignStatus(tenantId: string, campaignId: string, status: CampaignStatus): Promise<void> {
        await firebaseService.setDoc<'tenants/{tenantId}/campaigns'>(
            'campaigns',
            campaignId,
            { status, updatedAt: new Date() },
            tenantId,
            true
        );
    }

    /**
     * Delete a campaign
     */
    async deleteCampaign(tenantId: string, campaignId: string): Promise<Result<void>> {
        try {
            await firebaseService.deleteDoc('campaigns', campaignId, tenantId);
            return { success: true, data: undefined };
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            return { success: false, error: err };
        }
    }
}

export const campaignService = CampaignService.getInstance();
export default campaignService;