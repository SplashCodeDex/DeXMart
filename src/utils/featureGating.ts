import { Tenant } from '../types/contracts.js';
import { Timestamp } from 'firebase-admin/firestore';
import { systemAuthorityService, PlanTier } from '../services/SystemAuthorityService.js';

export type Feature = 'ai' | 'backups' | 'broadcast' | 'analytics';

export interface PlanLimits {
  maxChannels: number;
  maxBroadcasts: number;
  aiType: 'basic' | 'advanced' | 'none';
  analyticsLevel: 'basic' | 'advanced' | 'enterprise';
}

/**
 * Utility to check if a tenant has access to a specific feature.
 * Delegates to SystemAuthorityService.
 */
export const hasFeatureAccess = (tenant: Tenant, feature: Feature): boolean => {
  const plan = (tenant.plan || 'starter') as PlanTier;
  const caps = systemAuthorityService.getCapabilities(plan);

  // Check if trial has expired and status is not active
  if (tenant.subscriptionStatus === 'canceled') return false;
  if (tenant.subscriptionStatus === 'unpaid') return false;

  switch (feature) {
    case 'ai':
      return caps.models.length > 0;
    case 'backups':
      return caps.features.backups;
    case 'broadcast':
      return caps.features.marketing;
    case 'analytics':
      return true; // Analytics usually available in all tiers with diff levels
    default:
      return false;
  }
};

/**
 * Get limits associated with a plan.
 * Map SystemAuthorityService capabilities back to legacy PlanLimits structure.
 */
export const getPlanLimits = (plan: 'starter' | 'pro' | 'enterprise'): PlanLimits => {
  const caps = systemAuthorityService.getCapabilities(plan);

  return {
    maxChannels: caps.maxChannelSlots,
    maxBroadcasts: plan === 'enterprise' ? Infinity : plan === 'pro' ? 5000 : 500,
    aiType: caps.features.aiReasoning ? 'advanced' : 'basic',
    analyticsLevel: plan === 'enterprise' ? 'enterprise' : plan === 'pro' ? 'advanced' : 'basic'
  };
};

/**
 * Check if the tenant is currently in a valid trial period
 */
export const isTrialActive = (tenant: Tenant): boolean => {
  if (!tenant.trialEndsAt) return false;

  const now = Date.now();
  const trialEnd = tenant.trialEndsAt instanceof Timestamp
    ? tenant.trialEndsAt.toMillis()
    : new Date(tenant.trialEndsAt).getTime();

  return now < trialEnd;
};
