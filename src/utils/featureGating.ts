import { Tenant } from '../types/contracts.js';
import { Timestamp } from 'firebase-admin/firestore';
import { getCapabilities, PlanTier } from '../billing/auth-guard.js';

export type Feature = 'ai' | 'backups' | 'broadcast' | 'analytics';

export interface PlanLimits {
  maxChannels: number;
  maxBroadcasts: number;
  aiType: 'basic' | 'advanced' | 'none';
  analyticsLevel: 'basic' | 'advanced' | 'enterprise';
}

/**
 * Utility to check if a tenant has access to a specific feature.
 */
export const hasFeatureAccess = (tenant: Tenant, feature: Feature): boolean => {
  const plan = (tenant.plan || 'starter') as PlanTier;

  if (tenant.subscriptionStatus === 'canceled') return false;
  if (tenant.subscriptionStatus === 'unpaid') return false;

  switch (feature) {
    case 'ai':
      // Starter gets AI only when explicitly enabled via tenant settings
      if (plan === 'starter') {
        return (tenant as any).settings?.aiEnabled === true;
      }
      return true;
    case 'backups':
      // Backups available on all plans
      return true;
    case 'broadcast':
      return getCapabilities(plan).features.marketing;
    case 'analytics':
      return true;
    default:
      return false;
  }
};

const PLAN_CHANNEL_LIMITS: Record<PlanTier, number> = {
  starter: 1,
  pro: 3,
  enterprise: 10,
};

/**
 * Get limits associated with a plan.
 */
export const getPlanLimits = (plan: 'starter' | 'pro' | 'enterprise'): PlanLimits => {
  return {
    maxChannels: PLAN_CHANNEL_LIMITS[plan],
    maxBroadcasts: plan === 'enterprise' ? Infinity : plan === 'pro' ? 5000 : 500,
    aiType: plan === 'starter' ? 'basic' : 'advanced',
    analyticsLevel: plan === 'enterprise' ? 'enterprise' : plan === 'pro' ? 'advanced' : 'basic',
  };
};

/**
 * Check if the tenant is currently in a valid trial period.
 */
export const isTrialActive = (tenant: Tenant): boolean => {
  if (tenant.subscriptionStatus !== 'trialing') return false;
  if (!tenant.trialEndsAt) return false;

  const now = Date.now();
  const trialEnd = tenant.trialEndsAt instanceof Timestamp
    ? tenant.trialEndsAt.toMillis()
    : new Date(tenant.trialEndsAt).getTime();

  return now < trialEnd;
};
