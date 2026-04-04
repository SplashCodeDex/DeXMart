import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';
import { firebaseService } from './FirebaseService.js';
import { ChannelMember, Result, ChannelMemberSchema, ChannelGroupDocument } from '../types/index.js';
import { Timestamp } from 'firebase-admin/firestore';

/** Soft-deleted document marker */
interface DeletedDocument {
    deletedAt: Timestamp;
}

/**
 * DatabaseService (2026 Mastermind Edition)
 *
 * Handles all bot-related data operations with strict multi-tenancy subcollection patterns.
 * Mandate: Every data access must be scoped by tenantId.
 */
export class DatabaseService {

    /**
     * Get member (WhatsApp user) by JID within a tenant
     */
    async getUser(tenantId: string, jid: string): Promise<ChannelMember | null> {
        try {
            const data = await firebaseService.getDoc<'tenants/{tenantId}/members'>('members', jid, tenantId);
            if (!data) return null;

            // Zero-Trust Validation
            return ChannelMemberSchema.parse(data);
        } catch (error: unknown) {
            logger.error(`DatabaseService.getUser error [${tenantId}/${jid}]:`, error);
            return null;
        }
    }

    /**
     * Create or Update member data (atomic merge)
     */
    async updateUser(tenantId: string, jid: string, data: Partial<ChannelMember>): Promise<Result<void>> {
        try {
            const updatePayload = {
                ...data,
                updatedAt: Timestamp.now()
            };

            await firebaseService.setDoc<'tenants/{tenantId}/members'>('members', jid, updatePayload, tenantId, true);
            return { success: true, data: undefined };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`DatabaseService.updateUser error [${tenantId}/${jid}]:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Delete user data
     */
    async deleteUser(tenantId: string, jid: string): Promise<Result<void>> {
        try {
            const docRef = db.collection('tenants').doc(tenantId).collection('members').doc(jid);
            await docRef.delete();
            return { success: true, data: undefined };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`DatabaseService.deleteUser error [${tenantId}/${jid}]:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Get group settings
     */
    async getGroup(tenantId: string, jid: string): Promise<ChannelGroupDocument | null> {
        try {
            const data = await firebaseService.getDoc<'tenants/{tenantId}/groups'>('groups', jid, tenantId);
            if (!data) return null;

            // Optional: You might want to parse against BotGroupSchema here too if strict runtime checks are needed
            // But since ChannelGroupDocument is looser (metadata: any), we can just return it or cast it
            // For 2026 Mastermind Compliance, let's parse strict fields where possible, or just return strict Type
            return data;
        } catch (error: unknown) {
            logger.error(`DatabaseService.getGroup error [${tenantId}/${jid}]:`, error);
            return null;
        }
    }

    /**
     * Create or Update group data (atomic merge)
     */
    async updateGroup(tenantId: string, jid: string, data: Partial<ChannelGroupDocument>): Promise<Result<void>> {
        try {
            const updatePayload = {
                ...data,
                updatedAt: Timestamp.now()
            };

            await firebaseService.setDoc<'tenants/{tenantId}/groups'>('groups', jid, updatePayload, tenantId, true);
            return { success: true, data: undefined };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`DatabaseService.updateGroup error [${tenantId}/${jid}]:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Get leaderboard (Top 10 by winGame/level)
     */
    async getLeaderboard(tenantId: string, limit: number = 10): Promise<ChannelMember[]> {
        try {
            const snapshot = await db.collection('tenants')
                .doc(tenantId)
                .collection('members')
                .orderBy('winGame', 'desc')
                .orderBy('level', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ChannelMemberSchema.parse({ id: doc.id, ...doc.data() }));
        } catch (error: unknown) {
            logger.error(`DatabaseService.getLeaderboard error [${tenantId}]:`, error);
            return [];
        }
    }

    /**
     * Check if a username is already taken within a tenant
     */
    async checkUsernameTaken(tenantId: string, username: string): Promise<boolean> {
        try {
            const snapshot = await db.collection('tenants')
                .doc(tenantId)
                .collection('members')
                .where('username', '==', username)
                .limit(1)
                .get();
            return !snapshot.empty;
        } catch (error: unknown) {
            logger.error(`DatabaseService.checkUsernameTaken error [${tenantId}/${username}]:`, error);
            return false;
        }
    }

    /**
     * Transfer coins between members (Atomic Transaction)
     */
    /**
     * Transfer coins between members (Atomic Transaction)
     */
    async transferCoins(tenantId: string, senderId: string, receiverId: string, amount: number): Promise<Result<void>> {
        try {
            await db.runTransaction(async (t) => {
                const membersCol = db.collection('tenants').doc(tenantId).collection('members');
                const senderRef = membersCol.doc(senderId);
                const receiverRef = membersCol.doc(receiverId);

                const senderDoc = await t.get(senderRef);
                if (!senderDoc.exists) throw new Error('Sender not found');

                const senderData = senderDoc.data() as ChannelMember;
                const currentCoins = senderData.coin || 0;

                if (currentCoins < amount) throw new Error('Insufficient funds');

                const receiverDoc = await t.get(receiverRef);
                const receiverCoins = (receiverDoc.data() as ChannelMember | undefined)?.coin || 0;

                t.update(senderRef, {
                    coin: currentCoins - amount,
                    updatedAt: Timestamp.now()
                });

                if (receiverDoc.exists) {
                    t.update(receiverRef, {
                        coin: receiverCoins + amount,
                        updatedAt: Timestamp.now()
                    });
                } else {
                    t.set(receiverRef, {
                        id: receiverId,
                        coin: amount,
                        level: 0,
                        winGame: 0,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                }
            });

            return { success: true, data: undefined };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`DatabaseService.transferCoins error [${tenantId}]:`, err);
            return { success: false, error: err };
        }
    }

    // --- 2026 Mastermind: Legacy & Multi-Tenant Bridge ---

    public user = {
        get: (jid: string, tenantId: string = 'system') => this.getUser(tenantId, jid),
        update: (jid: string, data: Partial<ChannelMember>, tenantId: string = 'system') => this.updateUser(tenantId, jid, data),
        delete: (jid: string, tenantId: string = 'system') => this.deleteUser(tenantId, jid),
    };

    public group = {
        get: (jid: string, tenantId: string = 'system') => this.getGroup(tenantId, jid),
        update: (jid: string, data: Partial<ChannelGroupDocument>, tenantId: string = 'system') => this.updateGroup(tenantId, jid, data),
    };

    public chat = {
        clearHistory: async (jid: string, tenantId: string = 'system') => {
            try {
                await firebaseService.deleteDoc('tenants/{tenantId}/conversation_memory' as any, jid, tenantId);
                logger.info(`Chat history cleared for ${jid} (${tenantId})`);
            } catch (error: any) {
                logger.error(`DatabaseService.clearHistory failed for ${jid} (${tenantId})`, error);
            }
        }
    };

    /**
     * Bridge for commands using databaseService.getDoc/setDoc directly
     */
    async getDoc<T>(collection: string, docId: string, tenantId: string = 'system'): Promise<T | null> {
        return await firebaseService.getDoc(collection as 'members' | 'groups', docId, tenantId) as T | null;
    }

    async updateDoc(collection: string, docId: string, data: Record<string, unknown>, tenantId: string = 'system'): Promise<void> {
        await firebaseService.setDoc(collection as 'members' | 'groups', docId, data, tenantId, true);
    }

    async setDoc(collection: string, docId: string, data: Record<string, unknown>, tenantId: string = 'system'): Promise<void> {
        await firebaseService.setDoc(collection as 'members' | 'groups', docId, data, tenantId, false);
    }

    /**
     * Generic bridge for commands using db.get/db.set
     */
    async get<T = unknown>(key: string): Promise<T | null> {
        return await firebaseService.getDoc('system' as 'members' | 'groups', key) as T | null;
    }

    async set(key: string, value: unknown): Promise<void> {
        await firebaseService.setDoc('system' as 'members' | 'groups', key, value as Record<string, unknown>);
    }

    async delete(key: string): Promise<void> {
        const deletedDoc: DeletedDocument = { deletedAt: Timestamp.now() };
        await firebaseService.setDoc('system' as 'members' | 'groups', key, deletedDoc as unknown as Record<string, unknown>, undefined, true);
    }

    async add(key: string, value: number): Promise<void> {
        const current = await this.get(key);
        const base = typeof current === 'number' ? current : 0;
        await this.set(key, base + value);
    }
}

export const databaseService = new DatabaseService();
export default databaseService;
