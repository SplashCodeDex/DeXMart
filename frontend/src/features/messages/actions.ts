'use server';

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api';
import type { ActionResult } from '@/types/api';

/**
 * Create a new campaign
 */
export async function createCampaign(
    prevState: ActionResult<unknown> | null,
    formData: FormData
): Promise<ActionResult<unknown>> {
    const jsonData = formData.get('data');
    if (!jsonData || typeof jsonData !== 'string') {
        return {
            success: false,
            error: { code: 'validation_error', message: 'Missing campaign data' }
        };
    }

    let data: unknown;
    try {
        data = JSON.parse(jsonData);
    } catch {
        return {
            success: false,
            error: { code: 'validation_error', message: 'Invalid JSON data' }
        };
    }

    const response = await api.post<unknown>('/api/campaigns', data);

    if (!response.success) {
        return {
            success: false,
            error: response.error,
        };
    }

    revalidatePath('/dashboard/campaigns');
    return { success: true, data: response.data };
}

/**
 * Start a campaign
 */
async function startCampaignAction(id: string): Promise<ActionResult<{ message: string }>> {
    const response = await api.post<{ message: string }>(`/api/campaigns/${id}/start`, {});
    if (!response.success) return { success: false, error: response.error };
    revalidatePath('/dashboard/campaigns');
    return { success: true, data: response.data };
}

/**
 * Pause a campaign
 */
async function pauseCampaignAction(id: string): Promise<ActionResult<{ message: string }>> {
    const response = await api.post<{ message: string }>(`/api/campaigns/${id}/pause`, {});
    if (!response.success) return { success: false, error: response.error };
    revalidatePath('/dashboard/campaigns');
    return { success: true, data: response.data };
}
