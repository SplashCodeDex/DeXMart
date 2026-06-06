'use client';

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

import { Campaign } from '../types';
import { useCampaignSocket } from './useCampaignSocket';

import { api } from '@/lib/api/client';

const campaignKeys = {
    all: ['campaigns'] as const,
    list: () => [...campaignKeys.all, 'list'] as const,
    detail: (id: string) => [...campaignKeys.all, 'detail', id] as const,
};

export function useCampaigns(): UseQueryResult<Campaign[]> {
    // Initialize socket connection for real-time updates
    useCampaignSocket();

    return useQuery({
        queryKey: campaignKeys.list(),
        queryFn: async () => {
            const response = await api.get<Campaign[]>('/api/campaigns');
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        }
    });
}

export function useCampaign(id: string): UseQueryResult<Campaign> {
    return useQuery({
        queryKey: campaignKeys.detail(id),
        queryFn: async () => {
            const response = await api.get<Campaign>(`/api/campaigns/${id}`);
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        },
        enabled: !!id,
    });
}

function useCreateCampaign(): UseMutationResult<Campaign, Error, Partial<Campaign>> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<Campaign>) => {
            const response = await api.post<Campaign>('/api/campaigns', data);
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
        },
    });
}

export function useStartCampaign(): UseMutationResult<{ message: string }, Error, string> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.post<{ message: string }>(`/api/campaigns/${id}/start`);
            if (!response.success) {
                throw new Error(response.error.message || 'Failed to start campaign');
            }
            return response.data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
            queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
        },
    });
}

export function usePauseCampaign(): UseMutationResult<{ message: string }, Error, string> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.post<{ message: string }>(`/api/campaigns/${id}/pause`);
            if (!response.success) {
                throw new Error(response.error.message || 'Failed to pause campaign');
            }
            return response.data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
            queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
        },
    });
}

export function useResumeCampaign(): UseMutationResult<{ message: string }, Error, string> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.post<{ message: string }>(`/api/campaigns/${id}/resume`);
            if (!response.success) {
                throw new Error(response.error.message || 'Failed to resume campaign');
            }
            return response.data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
            queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
        },
    });
}

export function useDuplicateCampaign(): UseMutationResult<Campaign, Error, string> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.post<Campaign>(`/api/campaigns/${id}/duplicate`);
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
        },
    });
}

export function useDeleteCampaign(): UseMutationResult<{ message: string }, Error, string> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.delete<{ message: string }>(`/api/campaigns/${id}`);
            if (!response.success) {
                throw new Error(response.error.message || 'Failed to delete campaign');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
        },
    });
}
