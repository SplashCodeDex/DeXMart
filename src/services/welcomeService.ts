/**
 * Welcome Service (2026 Mastermind Edition)
 *
 * Handles Welcome/Goodbye messages for groups.
 * Stateless service that reads configuration from Firestore.
 */

import { ActiveChannel } from '../types/index.js';
import logger from '../utils/logger.js';
import { GroupData } from '../types/contracts.js';

export class WelcomeService {

    /**
     * Handle participant updates (add/remove)
     */
    async handleGroupParticipantsUpdate(channel: ActiveChannel, update: { id: string; participants: string[]; action: string }): Promise<void> {
        const { id, participants, action } = update;
        const { databaseService } = channel.context;

        if (!databaseService) return;

        try {
            // 1. Fetch Group Settings from Tenant DB
            // Path: tenants/{tenantId}/groups/{groupJid}
            const groupDoc = await databaseService.getDoc<GroupData>('groups', id, channel.tenantId);

            if (!groupDoc || !groupDoc.settings?.welcome?.enabled) {
                return;
            }

            const welcomeConfig = groupDoc.settings.welcome;

            // 2. Determine Message Type
            let messageTemplate: string | undefined;
            if (action === 'add') {
                messageTemplate = welcomeConfig.message;
            } else if (action === 'remove') {
                messageTemplate = welcomeConfig.leaveMessage;
            }

            if (!messageTemplate) return;

            // 3. Prepare Metadata for Placeholders
            const groupName = groupDoc.subject || 'this group';
            const groupDesc = groupDoc.desc || '';

            // 4. Send Message for each participant
            for (const participant of participants) {
                const message = this.formatMessage(messageTemplate, {
                    user: `@${participant.split('@')[0]}`,
                    subject: groupName,
                    desc: groupDesc
                });

                await channel.sendMessage(id, {
                    text: message,
                    mentions: [participant]
                });
            }

        } catch (error) {
            logger.error(`WelcomeService failed for group ${id}`, error);
        }
    }

    /**
     * Replace placeholders in the message template
     */
    private formatMessage(template: string, data: { user: string; subject: string; desc: string }): string {
        return template
            .replace(/@user/g, data.user)
            .replace(/@subject/g, data.subject)
            .replace(/@desc/g, data.desc)
            .replace(/\\n/g, '\n'); // Handle escaped newlines
    }
}

export const welcomeService = new WelcomeService();
