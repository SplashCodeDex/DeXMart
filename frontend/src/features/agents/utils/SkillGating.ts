import { type PlanTier } from '../types';

import { useAuthorityStore } from '@/stores/useAuthorityStore';

/**
 * Checks if a specific skill is allowed for a user's billing tier.
 * Enforces dynamic, zero-drift policy via System Authority.
 */
export function isSkillAllowed(tier: PlanTier, skillId: string): boolean {
    const store = useAuthorityStore.getState();

    // Strict enforcement: only rely on backend capabilities
    if (store.tier === tier && store.capabilities) {
        return store.isSkillAllowed(skillId);
    }

    // Restrict access if limits are not yet loaded or if querying mismatched tier
    return false;
}

/**
 * Returns the list of skills allowed from the centralized capabilities store.
 */
function getAllowedSkills(tier: PlanTier): string[] {
    const store = useAuthorityStore.getState();

    // Strict enforcement
    if (store.tier === tier && store.capabilities) {
        return store.capabilities.allowedSkills;
    }

    // Zero-drift policy: No static fallbacks
    return [];
}
