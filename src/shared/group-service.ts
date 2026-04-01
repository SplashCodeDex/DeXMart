/**
 * Group Service (2026 Mastermind Edition)
 *
 * Stateless service to handle all WhatsApp group operations.
 * Wraps Baileys socket methods and integrates with Tenant Database.
 */

import { GroupMetadata } from 'baileys';
import { ActiveChannel as Channel, GroupFunctions } from '../types/index.js';
import { Timestamp } from 'firebase-admin/firestore';
import logger from '../utils/logger.js';

export class GroupService {

    /**
     * Create a scoped GroupFunctions object for a specific message context
     */
    createFunctions(channel: Channel, _tenantId: string, groupJid: string, senderJid: string): GroupFunctions {
        return {
            isAdmin: async (targetJid = senderJid) => this.isAdmin(channel, groupJid, targetJid),
            matchAdmin: async (targetId: string) => this.matchAdmin(channel, groupJid, targetId),
            members: async () => this.getMembers(channel, groupJid),
            isActiveChannelAdmin: async () => this.isChannelAdmin(channel, groupJid),
            isChannelAdmin: async () => this.isChannelAdmin(channel, groupJid),
            metadata: async () => this.getMetadata(channel, groupJid),
            owner: async () => this.getOwner(channel, groupJid),
            name: async () => this.getName(channel, groupJid),
            open: async () => this.updateSetting(channel, groupJid, 'announcement', false),
            close: async () => this.updateSetting(channel, groupJid, 'announcement', true),
            lock: async () => this.updateSetting(channel, groupJid, 'locked', true),
            unlock: async () => this.updateSetting(channel, groupJid, 'locked', false),
            add: async (jids) => this.addParticipants(channel, groupJid, jids),
            kick: async (jids) => this.removeParticipants(channel, groupJid, jids),
            promote: async (jids) => this.promoteParticipants(channel, groupJid, jids),
            demote: async (jids) => this.demoteParticipants(channel, groupJid, jids),
            inviteCode: async () => this.getInviteCode(channel, groupJid),
            pendingMembers: async () => this.getPendingMembers(channel, groupJid),
            approvePendingMembers: async (jids) => this.handlePendingMembers(channel, groupJid, jids, 'approve'),
            rejectPendingMembers: async (jids) => this.handlePendingMembers(channel, groupJid, jids, 'reject'),
            updateDescription: async (desc) => this.updateDescription(channel, groupJid, desc),
            updateSubject: async (subject) => this.updateSubject(channel, groupJid, subject),
            joinApproval: async (mode) => this.updateJoinApproval(channel, groupJid, mode),
            membersCanAddMemberMode: async (mode) => this.updateMemberAddMode(channel, groupJid, mode),
            isOwner: async (targetJid = senderJid) => {
                const owner = await this.getOwner(channel, groupJid);
                // Check if targetJid matches owner or if superadmin logic applies
                return owner ? owner.includes(channel.decodeJid(targetJid)) : false;
            },
        };
    }

    // --- Core Implementations ---

    async getMetadata(channel: Channel, groupJid: string): Promise<Partial<GroupMetadata>> {
        try {
            if (!channel.groupMetadata) throw new Error('Channel does not support groupMetadata');
            return await channel.groupMetadata(groupJid);
        } catch (error) {
            logger.error(`GroupService.getMetadata failed for ${groupJid}`, error);
            return {};
        }
    }

    async getMembers(channel: Channel, groupJid: string): Promise<string[]> {
        const metadata = await this.getMetadata(channel, groupJid);
        if ('participants' in metadata && metadata.participants) {
            return metadata.participants.map((p) => p.id);
        }
        return [];
    }

    async isAdmin(channel: Channel, groupJid: string, userJid: string): Promise<boolean> {
        const metadata = await this.getMetadata(channel, groupJid);
        if ('participants' in metadata && metadata.participants) {
            const participant = metadata.participants.find((p) => p.id === userJid);
            return !!(participant && participant.admin);
        }
        return false;
    }

    async matchAdmin(channel: Channel, groupJid: string, userJid: string): Promise<boolean> {
        return this.isAdmin(channel, groupJid, userJid);
    }

    async isChannelAdmin(channel: Channel, groupJid: string): Promise<boolean> {
        const channelId = channel.user?.id ? channel.decodeJid(channel.user.id) : undefined;
        if (!channelId) return false;
        return this.isAdmin(channel, groupJid, channelId);
    }

    async getOwner(channel: Channel, groupJid: string): Promise<string | null> {
        const metadata = await this.getMetadata(channel, groupJid);
        if ('owner' in metadata) {
            return metadata.owner || metadata.subjectOwner || null;
        }
        return null;
    }

    async getName(channel: Channel, groupJid: string): Promise<string> {
        const metadata = await this.getMetadata(channel, groupJid);
        if ('subject' in metadata && metadata.subject) {
            return metadata.subject;
        }
        return 'Unknown Group';
    }

    // --- Actions ---

    async addParticipants(channel: Channel, groupJid: string, jids: string[]) {
        try {
            if (!channel.groupParticipantsUpdate) throw new Error('Method not supported');
            return await channel.groupParticipantsUpdate(groupJid, jids, 'add');
        } catch (error) {
            logger.error(`GroupService.add failed`, error);
            return { error };
        }
    }

    async removeParticipants(channel: Channel, groupJid: string, jids: string[]) {
        try {
            if (!channel.groupParticipantsUpdate) throw new Error('Method not supported');
            return await channel.groupParticipantsUpdate(groupJid, jids, 'remove');
        } catch (error) {
            logger.error(`GroupService.remove failed`, error);
            return { error };
        }
    }

    async promoteParticipants(channel: Channel, groupJid: string, jids: string[]) {
        try {
            if (!channel.groupParticipantsUpdate) throw new Error('Method not supported');
            return await channel.groupParticipantsUpdate(groupJid, jids, 'promote');
        } catch (error) {
            logger.error(`GroupService.promote failed`, error);
            return { error };
        }
    }

    async demoteParticipants(channel: Channel, groupJid: string, jids: string[]) {
        try {
            if (!channel.groupParticipantsUpdate) throw new Error('Method not supported');
            return await channel.groupParticipantsUpdate(groupJid, jids, 'demote');
        } catch (error) {
            logger.error(`GroupService.demote failed`, error);
            return { error };
        }
    }

    async updateSubject(channel: Channel, groupJid: string, subject: string) {
        try {
            if (!channel.groupUpdateSubject) throw new Error('Method not supported');
            return await channel.groupUpdateSubject(groupJid, subject);
        } catch (error) {
            logger.error(`GroupService.updateSubject failed`, error);
            return { error };
        }
    }

    async updateDescription(channel: Channel, groupJid: string, description: string) {
        try {
            if (!channel.groupUpdateDescription) throw new Error('Method not supported');
            return await channel.groupUpdateDescription(groupJid, description);
        } catch (error) {
            logger.error(`GroupService.updateDescription failed`, error);
            return { error };
        }
    }

    async updateSetting(channel: Channel, groupJid: string, setting: 'announcement' | 'locked', value: boolean) {
        try {
            if (!channel.groupSettingUpdate) throw new Error('Method not supported');
            // Baileys 'groupSettingUpdate' handling
            // Map our logical setting to Baileys expected string
            let action: 'announcement' | 'not_announcement' | 'locked' | 'unlocked' | null = null;

            if (setting === 'announcement') {
                action = value ? 'announcement' : 'not_announcement';
            } else if (setting === 'locked') {
                action = value ? 'locked' : 'unlocked';
            }

            if (action) {
                await channel.groupSettingUpdate(groupJid, action);
                this.syncGroup(channel, groupJid); // Optimistic sync
                return;
            }
        } catch (error) {
            logger.error(`GroupService.updateSetting failed to set ${setting} to ${value}`, error);
            return { error };
        }
    }

    async updateJoinApproval(channel: Channel, groupJid: string, mode: 'on' | 'off') {
        try {
            if (!channel.groupJoinApprovalMode) throw new Error('Method not supported');
            return await channel.groupJoinApprovalMode(groupJid, mode);
        } catch (error) {
            logger.error(`GroupService.updateJoinApproval failed`, error);
            return { error };
        }
    }

    async getPendingMembers(channel: Channel, groupJid: string) {
        try {
            if (!channel.groupRequestParticipantsList) throw new Error('Method not supported');
            return await channel.groupRequestParticipantsList(groupJid);
        } catch (error) {
            logger.error(`GroupService.getPendingMembers failed`, error);
            return [];
        }
    }

    async handlePendingMembers(channel: Channel, groupJid: string, jids: string[], action: 'approve' | 'reject') {
        try {
            if (!channel.groupRequestParticipantsUpdate) throw new Error('Method not supported');
            return await channel.groupRequestParticipantsUpdate(groupJid, jids, action);
        } catch (error) {
            logger.error(`GroupService.handlePendingMembers failed for ${action}`, error);
            return { error };
        }
    }

    async updateMemberAddMode(channel: Channel, groupJid: string, mode: boolean | 'on' | 'off') {
        try {
            if (!channel.groupMemberAddMode) throw new Error('Method not supported');
            const isEnable = typeof mode === 'boolean' ? mode : mode === 'on';
            await channel.groupMemberAddMode(groupJid, isEnable ? 'all_member_add' : 'admin_add');
            return { success: true };
        } catch (error) {
            logger.error(`GroupService.updateMemberAddMode failed`, error);
            return { error };
        }
    }

    async getInviteCode(channel: Channel, groupJid: string): Promise<string> {
        try {
            if (!channel.groupInviteCode) throw new Error('Method not supported');
            return await channel.groupInviteCode(groupJid) || '';
        } catch (error) {
            logger.error(`GroupService.getInviteCode failed`, error);
            return '';
        }
    }

    /**
     * Delta-Sync: Syncs group metadata only if it's stale or missing.
     * @param channel The active WhatsApp channel
     * @param groupJids List of JIDs to check
     * @param options Sync options (force, priority)
     */
    async syncDelta(channel: Channel, groupJids: string[], options: { force?: boolean } = {}): Promise<void> {
        try {
            const { databaseService } = channel.context;
            if (!databaseService) return;

            logger.info(`[GroupService] Starting Delta-Sync for ${groupJids?.length || 'all'} groups on ${channel.channelId}`);

            const jidsToSync = groupJids && groupJids.length > 0
                ? groupJids
                : (channel.getSocket()?.store?.chats?.all() || [])
                    .filter((c: any) => c.id.endsWith('@g.us'))
                    .map((c: any) => c.id);

            // Scenario 26+27: Process in chunks to avoid Firestore write-rate limits and
            // blocking the event loop on large (5000+) group lists.
            const CHUNK_SIZE = 50;
            const INTER_CHUNK_DELAY_MS = 500;

            for (let offset = 0; offset < jidsToSync.length; offset += CHUNK_SIZE) {
                const chunk = jidsToSync.slice(offset, offset + CHUNK_SIZE);

                for (const jid of chunk) {
                    // 1. Check if we already have a recent sync
                    const existing = await databaseService.getGroup(channel.tenantId, jid);

                    if (!options.force && existing) {
                        const lastSynced = existing.syncedAt instanceof Timestamp
                            ? existing.syncedAt.toDate()
                            : (existing.syncedAt ? new Date(existing.syncedAt as any) : new Date(0));
                        const now = new Date();
                        const diffMinutes = (now.getTime() - lastSynced.getTime()) / (1000 * 60);

                        // If synced within the last 4 hours, skip
                        if (diffMinutes < 240) {
                            logger.debug(`[GroupService] Skipping sync for ${jid} - last sync was ${Math.round(diffMinutes)}m ago`);
                            continue;
                        }
                    }

                    await this.syncGroup(channel, jid);
                }

                // Yield between chunks: prevents Firestore write bursts and keeps the
                // event loop responsive for large groups (Scenario 26+27).
                if (offset + CHUNK_SIZE < jidsToSync.length) {
                    await new Promise(resolve => setTimeout(resolve, INTER_CHUNK_DELAY_MS));
                }
            }

            logger.info(`[GroupService] Delta-Sync complete: ${jidsToSync.length} groups processed for ${channel.channelId}`);
        } catch (error) {
            logger.error(`[GroupService] Delta-Sync failed for ${channel.channelId}`, error);
        }
    }

    /**
     * Syncs group metadata from Baileys to Firestore
     * Uses Tenant-Scoped path: tenants/{tenantId}/groups/{groupJid}
     */
    async syncGroup(channel: Channel, groupJid: string): Promise<void> {
        try {
            const { databaseService } = channel.context;
            if (!databaseService) return;

            const metadata = await this.getMetadata(channel, groupJid);
            if (!metadata || !metadata.id) return;

            const participants = metadata.participants || [];
            const admins = participants.filter(p => p.admin).map(p => p.id);
            const memberIds = participants.map(p => p.id);

            const groupData = {
                id: metadata.id,
                subject: metadata.subject || 'Unknown Group',
                owner: metadata.owner || metadata.subjectOwner || null,
                creation: metadata.creation ? new Date(metadata.creation * 1000) : new Date(),
                desc: metadata.desc?.toString() || '',
                participants: memberIds,
                admins: admins,
                settings: {
                    announcement: metadata.announce || false,
                    locked: metadata.restrict || false
                },
                updatedAt: new Date(),
                syncedAt: new Date()
            };

            await databaseService.setDoc(
                'groups', // Collection name relative to tenant
                groupJid,
                groupData,
                channel.tenantId
            );

            logger.info(`Synced group ${metadata.subject} (${groupJid}) for tenant ${channel.tenantId}`);

        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`GroupService.syncGroup failed for ${groupJid}`, err);
        }
    }

    /**
     * Fetch all groups the channel is participating in and sync them to Firestore
     */
    async syncAllGroups(channel: Channel): Promise<void> {
        try {
            if (!channel.groupFetchAllParticipating) {
                logger.warn(`Channel ${channel.channelId} does not support groupFetchAllParticipating`);
                return;
            }

            const groups = await channel.groupFetchAllParticipating();
            const groupJids = Object.keys(groups);

            logger.info(`Syncing ${groupJids.length} groups for channel ${channel.channelId}`);

            for (const jid of groupJids) {
                await this.syncGroup(channel, jid);
            }

            logger.info(`Successfully synced all groups for channel ${channel.channelId}`);
        } catch (error) {
            logger.error(`GroupService.syncAllGroups failed for channel ${channel.channelId}`, error);
        }
    }
}

export const groupService = new GroupService();
