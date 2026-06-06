import { TenantSettings } from "@/types/contracts";
import { api } from "./client";

const tenantApi = {
  getSettings: async () => {
    const response = await api.get<TenantSettings>("/api/tenant/settings");
    if (!response.success) {
      throw new Error(response.error.message);
    }
    return response.data;
  },

  updateSettings: async (settings: Partial<TenantSettings>) => {
    const response = await api.patch<TenantSettings>("/api/tenant/settings", settings);
    if (!response.success) {
      throw new Error(response.error.message);
    }
    return response.data;
  },
};
