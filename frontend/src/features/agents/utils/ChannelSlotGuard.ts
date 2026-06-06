import { type PlanTier } from '../types';

import { useAuthorityStore } from '@/stores/useAuthorityStore';

/**
 * Utility to determine if a user can add another channel slot based on their billing tier.
 * Delegates to System Authority for strict zero-drift policy enforcement.
 */
export function canAddChannelSlot(tier: PlanTier, currentCount: number): boolean {
    const limit = getSlotLimit(tier);
    return currentCount < limit;
}

/**
 * Gets the slot limit strictly from the centralized capability store.
 */
function getSlotLimit(tier: PlanTier): number {
    const store = useAuthorityStore.getState();
    
    // If checking against the current user's tier, use the authoritative backend response
    if (store.tier === tier && store.capabilities) {
        return store.getLimit('maxChannelSlots');
    }

    // Zero-drift policy: Do not fall back to static hardcoded arrays.
    // Restrict access by default if capabilities are missing or for non-active tiers.
    return 0;
}
