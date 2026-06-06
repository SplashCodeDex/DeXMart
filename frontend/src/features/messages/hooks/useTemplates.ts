'use client';

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

import { MessageTemplate } from '../types';

import { api } from '@/lib/api/client';

const templateKeys = {
    all: ['templates'] as const,
    list: () => [...templateKeys.all, 'list'] as const,
};

export function useTemplates(): UseQueryResult<MessageTemplate[]> {
    return useQuery({
        queryKey: templateKeys.list(),
        queryFn: async () => {
            const response = await api.get<MessageTemplate[]>('/api/templates');
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        }
    });
}

function useCreateTemplate(): UseMutationResult<MessageTemplate, Error, Partial<MessageTemplate>> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<MessageTemplate>) => {
            const response = await api.post<MessageTemplate>('/api/templates', data);
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: templateKeys.list() });
        },
    });
}

export function useSpinMessage(): UseMutationResult<string, Error, string> {
    return useMutation({
        mutationFn: async (content: string) => {
            const response = await api.post<string>('/api/templates/spin', { content });
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        }
    });
}
