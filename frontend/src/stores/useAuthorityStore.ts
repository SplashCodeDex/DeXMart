import { create } from "zustand";
import { api } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { AuthorityState, PlanTier, Capabilities } from "@/types/authority";

interface AuthorityStore extends AuthorityState {
  fetchCapabilities: () => Promise<void>;
  isFeatureAllowed: (feature: keyof Capabilities["features"]) => boolean;
  isSkillAllowed: (skillId: string) => boolean;
  getLimit: (
    metric: keyof Pick<Capabilities, "maxMessages" | "maxAgents" | "maxChannelSlots">,
  ) => number;
}

export const useAuthorityStore = create<AuthorityStore>((set, get) => ({
  tier: "starter",
  capabilities: null,
  isLoading: false,
  error: null,

  fetchCapabilities: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ tier: PlanTier; capabilities: Capabilities }>(
        API_ENDPOINTS.AUTHORITY.CAPABILITIES,
      );

      if (response.success) {
        set({
          tier: response.data.tier,
          capabilities: response.data.capabilities,
          isLoading: false,
        });
      } else {
        set({
          error: response.error.message || "Failed to fetch capabilities",
          isLoading: false,
        });
      }
    } catch (err: unknown) {
      set({
        error: (err instanceof Error ? err.message : null) || "An unexpected error occurred",
        isLoading: false,
      });
    }
  },

  isFeatureAllowed: (feature) => {
    const { capabilities } = get();
    if (!capabilities) return false;
    return !!capabilities.features[feature];
  },

  isSkillAllowed: (skillId) => {
    const { capabilities } = get();
    if (!capabilities) return false;
    return capabilities.allowedSkills.includes(skillId);
  },

  getLimit: (metric) => {
    const { capabilities } = get();
    if (!capabilities) return 0;
    return capabilities[metric] || 0;
  },
}));
