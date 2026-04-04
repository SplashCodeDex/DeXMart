import { antiBanService } from '../services/antiBanService.js';
import { firebaseService } from '../services/FirebaseService.js';
import { getCampaignWorker } from '../jobs/campaignWorker.js';
import logger from '../utils/logger.js';
import { socketService } from '../services/socketService.js';

/**
 * Anti-Ban Resume Worker
 * 
 * Periodically scans for expired cooldowns and automatically resumes 
 * campaigns for Pro/Enterprise users.
 */
export const initializeAntiBanResumeWorker = (intervalMs: number = 20000) => {
    logger.info(`Initializing Anti-Ban Resume Worker (Interval: ${intervalMs}ms)...`);

    setInterval(async () => {
        try {
            await processExpiredCooldowns();
        } catch (error) {
            logger.error('[AntiBanResumeWorker] Loop iteration failed:', error);
        }
    }, intervalMs);
};

async function processExpiredCooldowns() {
    const expired = await antiBanService.getExpiredCooldowns();
    if (expired.length === 0) return;

    for (const metadata of expired) {
        try {
            const { tenantId, campaignId, autoResume, redisKey } = metadata;

            if (autoResume) {
                logger.info(`[AntiBanResumeWorker] Auto-resuming campaign ${campaignId} for tenant ${tenantId}`);
                
                // 1. Flip status in Firebase to 'queued'
                // We use 'queued' so the CampaignWorker picks it up in its next pass
                await firebaseService.setDoc<'tenants/{tenantId}/campaigns'>(
                    'campaigns',
                    campaignId,
                    {
                        status: 'sending', 
                        updatedAt: new Date(),
                    },
                    tenantId,
                    true
                );

                // 2. Re-invoke the campaign worker by adding a job
                const campaign = await firebaseService.getDoc<'tenants/{tenantId}/campaigns'>('campaigns', campaignId, tenantId);
                if (campaign) {
                    const campaignWorker = getCampaignWorker();
                    // Pulse the queue to make sure it's processed
                    await (campaignWorker as any).worker.queue.add('process-campaign', { tenantId, campaign });
                }

                // 3. Emit socket alert
                socketService.emitToTenant(tenantId, 'antiban_alert', {
                    campaignId,
                    action: 'resumed',
                    message: `✅ Anti-Ban protection window cleared. Your campaign has been automatically resumed.`,
                });

                // 4. Cleanup the cooldown key
                await antiBanService.removeCooldown(redisKey);
            } else {
                // For Free users, we just let the key expire or stay there until they click resume.
                // But we should probably cleanup eventually if they don't resume.
                // For now, we leave it for manual action.
                logger.debug(`[AntiBanResumeWorker] Cooldown expired for ${campaignId}, but manual resume required.`);
            }
        } catch (err) {
            logger.error(`[AntiBanResumeWorker] Failed to resume campaign:`, { metadata, error: err });
        }
    }
}
