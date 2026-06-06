'use client';

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

import { Contact, ContactImportResult } from '../types';

import { api } from '@/lib/api/client';

const contactKeys = {
    all: ['contacts'] as const,
    list: () => [...contactKeys.all, 'list'] as const,
    audiences: () => [...contactKeys.all, 'audiences'] as const,
};

export function useContacts(): UseQueryResult<Contact[]> {
    return useQuery({
        queryKey: contactKeys.list(),
        queryFn: async () => {
            const response = await api.get<Contact[]>('/api/contacts');
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        }
    });
}

export function useImportContacts(): UseMutationResult<ContactImportResult, Error, string> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (csvData: string) => {
            const response = await api.post<ContactImportResult>('/api/contacts/import', { csvData });
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contactKeys.list() });
            queryClient.invalidateQueries({ queryKey: contactKeys.audiences() });
        }
    });
}

export function useDeleteContact(): UseMutationResult<unknown, Error, string> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.delete(`/api/contacts/${id}`);
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contactKeys.list() });
        }
    });
}

export function useUpdateContact(): UseMutationResult<Contact, Error, Partial<Contact> & { id: string }> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...data }: Partial<Contact> & { id: string }) => {
            const response = await api.patch<Contact>(`/api/contacts/${id}`, data);
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contactKeys.list() });
        }
    });
}

export function useCheckDuplicates(): UseMutationResult<string[], Error, string[]> {
    return useMutation({
        mutationFn: async (phones: string[]) => {
            const response = await api.post<string[]>('/api/contacts/check-duplicates', { phones });
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        }
    });
}

export function useImportHistory(): UseQueryResult<Record<string, unknown>[]> {
    return useQuery({
        queryKey: [...contactKeys.all, 'history'],
        queryFn: async () => {
            const response = await api.get<Record<string, unknown>[]>('/api/contacts/imports');
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        }
    });
}

export function useUndoImport(): UseMutationResult<unknown, Error, string> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.post(`/api/contacts/imports/${id}/undo`);
            if (!response.success) {
                throw new Error(response.error.message);
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contactKeys.list() });
            queryClient.invalidateQueries({ queryKey: contactKeys.all });
        }
    });
}
