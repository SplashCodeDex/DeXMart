import logger from '@/utils/logger.js';
import { PlanTier } from '../tenancy/tenant-context.js';
import { getCapabilities } from '../billing/auth-guard.js';
import { trackUsage } from '../billing/usage-tracker.js';
import { db } from '../lib/firebase.js';

/**
 * Usage Guard Service (Legacy Proxy)
 *
 * @deprecated Use pure functions from auth-guard.ts and trackUsage from usage-tracker.ts instead.
 */
export class UsageGuard {
    private static instance: UsageGuard;

    private constructor() { }

    /**
     * @deprecated Use pure functions from auth-guard.ts instead.
     */
    public static getInstance(): UsageGuard {
        if (!UsageGuard.instance) {
            UsageGuard.instance = new UsageGuard();
        }
        return UsageGuard.instance;
    }

    /**
     * Comprehensive check and increment for a tenant.
     * @deprecated Use `assertCan` and `trackUsage` instead.
     */
    public async checkAndIncrementUsage(tenantId: string): Promise<{ allowed: boolean; error?: string }> {
        try {
            const userRef = db.doc(`users/${tenantId}`);
            const doc = await userRef.get();

            if (!doc.exists) {
                return { allowed: false, error: 'User not found' };
            }

            const data = doc.data()!;
            const tier = (data.plan || 'starter') as PlanTier;
            const caps = getCapabilities(tier as any);
            const currentUsage = data.usage?.messagesThisPeriod || data.stats?.totalMessagesSent || 0;

            if (caps.maxMessages !== -1 && currentUsage >= caps.maxMessages) {
                return { allowed: false, error: 'Monthly usage limit reached' };
            }

            this.incrementUsage(tenantId);
            return { allowed: true };
        } catch (err: any) {
            logger.error(`[UsageGuard] checkAndIncrementUsage error for ${tenantId}:`, err);
            return { allowed: false, error: err.message || 'Monthly usage limit reached' };
        }
    }

    /**
     * Determines if a user can send more messages.
     * @deprecated Use `AuthGuard.canSendMessage` instead.
     */
    public canSend(tier: PlanTier, currentMonthlyUsage: number): boolean {
        const caps = getCapabilities(tier as any);
        if (caps.maxMessages === -1) return true;
        return currentMonthlyUsage < caps.maxMessages;
    }

    /**
     * Increments the message usage for a tenant.
     * @deprecated Use `trackUsage` instead.
     */
    public incrementUsage(tenantId: string, amount: number = 1): void {
        return trackUsage(tenantId, 'messages', amount);
    }

    /**
     * Gets the monthly message limit for a specific tier.
     * @deprecated Use `getCapabilities` instead.
     */
    public getMonthlyLimit(tier: PlanTier): number {
        const caps = getCapabilities(tier as any);
        return caps.maxMessages;
    }
}

/**
 * @deprecated Use `systemAuthorityService` from auth-guard.ts instead.
 */
export const usageGuard = UsageGuard.getInstance();
export type { PlanTier };
