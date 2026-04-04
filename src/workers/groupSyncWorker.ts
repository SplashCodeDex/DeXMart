/**
 * WhatsApp Group Sync Worker (2026 Mastermind Edition)
 *
 * Handles asynchronous synchronization of WhatsApp group metadata.
 * Processes both priority (active chats) and background (cold groups) sync tasks.
 */

import { Job } from 'bullmq';
import { jobQueueService } from '../services/jobQueue.js';
import { groupService } from '../services/groupService.js';
import { channelService } from '../services/ChannelService.js';
import { channelManager } from '../services/channels/ChannelManager.js';
import { ActiveChannel } from '../types/index.js';
import logger from '../utils/logger.js';

interface GroupSyncJobData {
    tenantId: string;
    channelId: string;
    groupJids: string[];
    options?: {
        force?: boolean;
    };
}

/**
 * Initialize the Group Sync Worker
 */
export function initializeGroupSyncWorker() {
    logger.info('[GroupSyncWorker] Initializing Group Sync Worker...');

    jobQueueService.process('group-sync', async (job: Job<GroupSyncJobData>) => {
        const { tenantId, channelId, groupJids, options } = job.data;

        try {
            logger.info(`[GroupSyncWorker] Processing sync for ${groupJids?.length || 0} groups | Channel: ${channelId}`);

            // Scenario 27: Large group lists (5000+) are split into sub-jobs so no single
            // worker is blocked for minutes and the job lock is never exceeded.
            const MAX_JIDS_PER_JOB = 200;
            if (groupJids && groupJids.length > MAX_JIDS_PER_JOB) {
                logger.info(`[GroupSyncWorker] Large sync detected (${groupJids.length} groups). Splitting into sub-jobs of ${MAX_JIDS_PER_JOB}.`);
                for (let i = 0; i < groupJids.length; i += MAX_JIDS_PER_JOB) {
                    const chunk = groupJids.slice(i, i + MAX_JIDS_PER_JOB);
                    await jobQueueService.addJob('group-sync', 'sync-groups', { tenantId, channelId, groupJids: chunk, options });
                }
                return { split: Math.ceil(groupJids.length / MAX_JIDS_PER_JOB) };
            }

            // 1. Get the channel instance from service (to check existence/access)
            const result = await channelService.getChannel(tenantId, channelId);
            if (!result.success) {
                logger.warn(`[GroupSyncWorker] Skipping job: Channel ${channelId} not found or error: ${result.error?.message || 'Unknown error'}`);
                return;
            }

            // Use ChannelManager to get the live active adapter instance
            const activeChannel = channelManager.getAdapter(channelId);
            if (!activeChannel || activeChannel.status !== 'connected') {
                logger.warn(`[GroupSyncWorker] Skipping job: Channel ${channelId} instance not active or not connected`);
                return;
            }

            // 2. Execute Delta-Sync
            // Cast to any then ActiveChannel because ChannelAdapter is more minimal than ActiveChannel
            await groupService.syncDelta(activeChannel as any as ActiveChannel, (groupJids || []) as string[], options);

            logger.info(`[GroupSyncWorker] Successfully processed ${groupJids?.length || 0} groups for ${channelId}`);

            return { processed: groupJids?.length || 0 };
        } catch (error) {
            logger.error(`[GroupSyncWorker] Failed to process sync job ${job.id}`, error);
            throw error;
        }
    });

    logger.info('[GroupSyncWorker] Group Sync Worker registered and listening');
}
