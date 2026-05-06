import { api } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { tenantApi } from "@/lib/api/tenant";
import type { Webhook, TenantSettings } from "@/types/contracts";

/**
 * Get tenant settings
 */
export async function getTenantSettings(): Promise<TenantSettings> {
  return await tenantApi.getSettings();
}

/**
 * Update tenant settings
 */
export async function updateTenantSettings(
  settings: Partial<TenantSettings>,
): Promise<TenantSettings> {
  return await tenantApi.updateSettings(settings);
}

/**
 * Get webhooks for the current tenant
 */
export async function getWebhooks(): Promise<Webhook[]> {
  const response = await api.get<Webhook[]>(API_ENDPOINTS.WEBHOOKS.LIST);
  if (!response.success) {
    throw new Error(typeof response.error === "string" ? response.error : response.error.message);
  }
  return response.data;
}

/**
 * Create a new webhook
 */
export async function createWebhook(data: Partial<Webhook>): Promise<Webhook> {
  const response = await api.post<Webhook>(API_ENDPOINTS.WEBHOOKS.CREATE, data);
  if (!response.success) {
    throw new Error(typeof response.error === "string" ? response.error : response.error.message);
  }
  return response.data;
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(id: string): Promise<void> {
  const response = await api.delete(API_ENDPOINTS.WEBHOOKS.DELETE(id));
  if (!response.success) {
    throw new Error(typeof response.error === "string" ? response.error : response.error.message);
  }
}

/**
 * Get tenant by ID
 */
export async function getTenantById(_tenantId: string): Promise<null> {
  // Implementation will fetch tenant document via backend
  return null;
}
