import logger from '@/utils/logger.js';
import { db } from '../lib/firebase.js';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export type PlanTier = 'starter' | 'pro' | 'enterprise';

export interface Capabilities {
    maxMessages: number;
    maxAgents: number;
    maxChannelSlots: number;
    minCronIntervalMs: number;
    allowedSkills: string[];
    features: {
        marketing: boolean;
        backups: boolean;
        aiReasoning: boolean;
        aiMessageSpinning: boolean;
    };
    models: string[];
}

const CAPABILITY_MATRIX: Record<PlanTier, Capabilities> = {
    starter: {
        maxMessages: 1000,
        maxAgents: 1,
        maxChannelSlots: 1,
        minCronIntervalMs: 60 * 60 * 1000, // 1 hour
        allowedSkills: ['basic_reply', 'summarize', 'translate'],
        features: {
            marketing: false,
            backups: false,
            aiReasoning: true,
            aiMessageSpinning: false,
        },
        models: ['gemini-1.5-flash']
    },
    pro: {
        maxMessages: 10000,
        maxAgents: 5,
        maxChannelSlots: 3,
        minCronIntervalMs: 15 * 60 * 1000, // 15 minutes
        allowedSkills: [
            'basic_reply', 'summarize', 'translate', 
            'web_search', 'file_analysis', 'image_generation'
        ],
        features: {
            marketing: true,
            backups: true,
            aiReasoning: true,
            aiMessageSpinning: false,
        },
        models: ['gemini-1.5-flash', 'gemini-1.5-pro']
    },
    enterprise: {
        maxMessages: 10000000,
        maxAgents: 100,
        maxChannelSlots: 100,
        minCronIntervalMs: 1 * 60 * 1000, // 1 minute
        allowedSkills: [
            'basic_reply', 'summarize', 'translate', 
            'web_search', 'file_analysis', 'image_generation',
            'custom_scripting', 'database_query'
        ],
        features: {
            marketing: true,
            backups: true,
            aiReasoning: true,
            aiMessageSpinning: true,
        },
        models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']
    }
};

/**
 * SystemAuthorityService
 * 
 * The single source of truth for all tier-based restrictions, feature access,
 * and agentic skill mappings in DeXMart.
 */
export class SystemAuthorityService {
    private static instance: SystemAuthorityService;

    private constructor() { }

    public static getInstance(): SystemAuthorityService {
        if (!SystemAuthorityService.instance) {
            SystemAuthorityService.instance = new SystemAuthorityService();
        }
        return SystemAuthorityService.instance;
    }

    /**
     * Retrieves the full capability matrix for a specific tier.
     */
    public getCapabilities(tier: PlanTier): Capabilities {
        return CAPABILITY_MATRIX[tier] || CAPABILITY_MATRIX.starter;
    }

    /**
     * Helper to check if a specific skill is allowed for a tier.
     */
    public isSkillAllowed(tier: PlanTier, skillId: string): boolean {
        const capabilities = this.getCapabilities(tier);
        return capabilities.allowedSkills.includes(skillId);
    }

    /**
     * Validates if a tenant can perform an action based on current usage and tier limits.
     */
    // B2C model: userId = the user's Firebase UID (user is the tenant).
    // All Firestore paths use /users/{userId}/ — not /tenants/{tenantId}/.
    public async checkAuthority(userId: string, action: 'send_message' | 'create_agent' | 'add_channel'): Promise<{ allowed: boolean; error?: string }> {
        try {
            const userRef = db.doc(`users/${userId}`);
            const doc = await userRef.get();

            if (!doc.exists) {
                return { allowed: false, error: 'User not found' };
            }

            const data = doc.data()!;
            const tier = (data.plan || 'starter') as PlanTier;
            const caps = this.getCapabilities(tier);

            switch (action) {
                case 'send_message': {
                    const currentUsage = data.usage?.messagesThisPeriod || data.stats?.totalMessagesSent || 0;
                    if (caps.maxMessages !== -1 && currentUsage >= caps.maxMessages) {
                        return { allowed: false, error: 'Monthly message limit reached' };
                    }
                    break;
                }
                case 'create_agent': {
                    // Per-user agent count stored in /users/{userId}/usage/counters
                    const counterRef = db.doc(`users/${userId}/usage/counters`);
                    const counterSnap = await counterRef.get();

                    // Resilient snap handling for both mock and real Firestore
                    const existsField = (counterSnap as any).exists;
                    const snapExists = typeof existsField === 'function' ? existsField.call(counterSnap) : !!existsField;

                    const dataField = (counterSnap as any).data;
                    const snapData = typeof dataField === 'function' ? dataField.call(counterSnap) : dataField;
                    const currentCount = snapExists ? (snapData?.agentCount || 0) : 0;

                    if (caps.maxAgents !== -1 && currentCount >= caps.maxAgents) {
                        return { allowed: false, error: `Agent limit reached for ${tier} plan.` };
                    }
                    break;
                }
                case 'add_channel': {
                    const currentCount = data.usage?.activeChannels || data.stats?.activeChannels || 0;
                    if (caps.maxChannelSlots !== -1 && currentCount >= caps.maxChannelSlots) {
                        return { allowed: false, error: `Channel slot limit reached for ${tier} plan.` };
                    }
                    break;
                }
            }

            return { allowed: true };
        } catch (error: any) {
            logger.error(`SystemAuthorityService.checkAuthority error for ${userId}:`, error);
            // Safety: allow on error but log
            return { allowed: true };
        }
    }

    /**
     * Increments usage for a specific metric.
     * Path: /users/{userId}/analytics/{date} and /users/{userId} (B2C — user is the tenant)
     */
    public async recordUsage(userId: string, metric: 'messages' | 'agents' | 'channels', amount: number = 1): Promise<void> {
        const userRef = db.doc(`users/${userId}`);
        const batch = db.batch();

        try {
            if (metric === 'messages') {
                const today = new Date().toISOString().split('T')[0];
                const analyticsRef = db.doc(`users/${userId}/analytics/${today}`);

                batch.set(analyticsRef, {
                    date: today,
                    sent: FieldValue.increment(amount),
                    updatedAt: Timestamp.now()
                }, { merge: true });

                batch.set(userRef, {
                    'usage.messagesThisPeriod': FieldValue.increment(amount),
                    updatedAt: Timestamp.now()
                }, { merge: true });
            } else if (metric === 'agents') {
                const counterRef = db.doc(`users/${userId}/usage/counters`);
                batch.set(counterRef, {
                    agentCount: FieldValue.increment(amount),
                    updatedAt: Timestamp.now()
                }, { merge: true });
            } else if (metric === 'channels') {
                batch.set(userRef, {
                    'usage.activeChannels': FieldValue.increment(amount),
                    updatedAt: Timestamp.now()
                }, { merge: true });
            }

            await batch.commit();
            logger.debug(`[Authority] Recorded ${amount} ${metric} usage for user ${userId}`);
        } catch (error) {
            logger.error(`[Authority] Failed to record ${metric} usage for user ${userId}:`, error);
        }
    }
}

export const systemAuthorityService = SystemAuthorityService.getInstance();
