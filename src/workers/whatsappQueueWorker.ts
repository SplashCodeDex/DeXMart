import { Job } from 'bullmq';
import jobQueueService from '../services/jobQueue.js';
import logger from '../utils/logger.js';
import { channelManager } from '../services/channels/ChannelManager.js';
import { WhatsappAdapter } from '../services/channels/whatsapp/WhatsappAdapter.js';
import { antiBanService } from '../services/antiBanService.js';

/**
 * Worker to process outbound WhatsApp messages with human-like delays
 * and Anti-Ban velocity enforcement.
 * 
 * This is the ONLY exit point for ALL WhatsApp messages (AI replies,
 * campaigns, direct sends). The Velocity Rule gate here protects
 * the server IP from being flagged by WhatsApp.
 */
export const initializeWhatsappWorker = () => {
    logger.info('Initializing WhatsApp Outbound Worker (Anti-Ban enabled)...');

    jobQueueService.process('whatsapp-outbound', async (job: Job) => {
        const { tenantId, channelId, jid, message, options } = job.data;

        logger.info(`Processing outbound WhatsApp message for ${jid} (Job: ${job.id})`);

        try {
            const adapter = channelManager.getAdapter(channelId) as WhatsappAdapter;
            if (!adapter) {
                throw new Error(`Adapter for channel ${channelId} not found in memory`);
            }

            // ─── ANTI-BAN: VELOCITY RULE GATE (ATOMIC) ───────────────
            // Enforce minimum 5-7s gap between messages per channel (number).
            let velocityDelay = 0;
            
            // If this job was already rescheduled for velocity, we skip the reservation
            // but still allow the human-mimicry jitter below.
            if (!job.data.skipVelocityReserve) {
                velocityDelay = await antiBanService.reserveVelocityDelay(channelId);
            }

            // AVOID STALLED JOBS: If delay > 25s, re-queue as a native delayed job
            // to free up this worker and prevent BullMQ from thinking we crashed.
            if (velocityDelay > 25000) {
                logger.info(`[AntiBan] Delay too long (${Math.round(velocityDelay)}ms). Rescheduling as delayed job...`);
                await jobQueueService.addJob('whatsapp-outbound', job.name || 'rescheduled-send', {
                    ...job.data,
                    skipVelocityReserve: true // Don't book another 6s slot when we wake up
                }, { delay: velocityDelay });
                return { success: true, rescheduled: true };
            }

            if (velocityDelay > 0) {
                logger.debug(
                    `[AntiBan] Velocity gate: delaying ${Math.round(velocityDelay)}ms ` +
                    `for channel ${channelId} (to ${jid})`
                );
                await new Promise(resolve => setTimeout(resolve, velocityDelay));
            }
            // ─────────────────────────────────────────────────────────

            // 1. Calculate a human-like delay based on message length
            // Base delay 2s + 50ms per character, capped at 10s
            const textLength = typeof message === 'string' ? message.length : 10;
            const baseDelay = 2000 + Math.min(textLength * 50, 8000);
            // Add randomness (+/- 20%)
            const jitter = baseDelay * (0.8 + Math.random() * 0.4);

            logger.debug(`Simulating typing for ${Math.round(jitter)}ms...`);

            // 2. Clear presence and set "composing"
            await adapter.getSocket()?.sendPresenceUpdate('composing', jid);

            // 3. Wait the duration
            await new Promise(resolve => setTimeout(resolve, jitter));

            // 4. Stop typing and send
            await adapter.getSocket()?.sendPresenceUpdate('paused', jid);

            // 5. Dispatch the message
            await (adapter as any)._directSendMessage(jid, message, options);

            logger.info(`Successfully dispatched message to ${jid} via queue`);
            return { success: true };
        } catch (error: any) {
            logger.error(`Failed to process WhatsApp job ${job.id}:`, error);
            throw error; // Let BullMQ handle retries
        }
    });
};
