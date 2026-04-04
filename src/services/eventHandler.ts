/**
 * Event Handler Service (2026 Mastermind Edition)
 *
 * Centralized handler for Baileys events.
 * Triggers side effects like Group Sync, Analytics, etc.
 */

import { ActiveChannel } from '../types/index.js';
import logger from '../utils/logger.js';
import { groupService } from './groupService.js';
import { welcomeService } from './welcomeService.js';

export class EventHandler {

    /**
     * Bind all event listeners to a channel instance
     */
    bind(channel: ActiveChannel) {
        // Group Updates (Name, Desc, Settings)
        channel.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                if (!update.id) continue;
                logger.debug(`[${channel.channelId}] Group update: ${update.id}`);
                await groupService.syncGroup(channel, update.id);
            }
        });

        // Participant Updates (Add, Remove, Promote, Demote)
        channel.ev.on('group-participants.update', async (update) => {
            if (!update.id) return;
            logger.debug(`[${channel.channelId}] Participants update: ${update.id}`);
            await groupService.syncGroup(channel, update.id);

            // Trigger Welcome/Goodbye
            if (update.action === 'add' || update.action === 'remove') {
                const standardizedUpdate = {
                    ...update,
                    participants: update.participants.map((p: any) => typeof p === 'object' ? p.id || p.jid : p) as string[]
                };
                await welcomeService.handleGroupParticipantsUpdate(channel, standardizedUpdate);
            }
        });

        // Anti-Call Protection
        channel.ev.on('call', async (calls) => {
            if (!channel.config?.antiCall) return;

            for (const call of calls) {
                if (call.status === 'offer') {
                    logger.info(`[${channel.channelId}] Incoming call from ${call.from}, rejecting...`);
                    // @ts-ignore - Baileys rejectCall type might be missing in some versions but works
                    if (channel.rejectCall) {
                        await channel.rejectCall(call.id, call.from);
                    }
                }
            }
        });

        // Initial Connection (Sync all groups?)
        // Note: Doing this on every connect might be heavy.
        // Better to rely on lazy sync or specific admin command 'sync-all'.
        // However, we can listen to 'connection.update' here if needed.
    }
}

export const eventHandler = new EventHandler();
