'use client';

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Audience } from '../types';

import { api, API_ENDPOINTS } from '@/lib/api';
import { isApiSuccess } from '@/types';

const audienceKeys = {
  all: ['audiences'] as const,
  list: () => [...audienceKeys.all, 'list'] as const,
  detail: (id: string) => [...audienceKeys.all, id] as const,
};

export function useAudiences(): UseQueryResult<Audience[]> {
  return useQuery({
    queryKey: audienceKeys.list(),
    queryFn: async () => {
      const response = await api.get<Audience[]>(API_ENDPOINTS.CONTACTS.AUDIENCES);
      if (!isApiSuccess(response)) {
        throw new Error(response.error.message || 'Failed to fetch audiences');
      }
      return response.data;
    },
  });
}

export function useCreateAudience(): UseMutationResult<Audience, Error, Omit<Audience, 'id' | 'createdAt' | 'updatedAt' | 'count'>> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<Audience, 'id' | 'createdAt' | 'updatedAt' | 'count'>) => {
      const response = await api.post<Audience>(API_ENDPOINTS.CONTACTS.AUDIENCES, data);
      if (!isApiSuccess(response)) {
        throw new Error(response.error.message || 'Failed to create audience');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: audienceKeys.all });
      toast.success('Audience created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

function useUpdateAudience(): UseMutationResult<Audience, Error, { id: string; data: Partial<Audience> }> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Audience> }) => {
      const response = await api.patch<Audience>(`${API_ENDPOINTS.CONTACTS.AUDIENCES}/${id}`, data);
      if (!isApiSuccess(response)) {
        throw new Error(response.error.message || 'Failed to update audience');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: audienceKeys.all });
      toast.success('Audience updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteAudience(): UseMutationResult<unknown, Error, string> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`${API_ENDPOINTS.CONTACTS.AUDIENCES}/${id}`);
      if (!isApiSuccess(response)) {
        throw new Error(response.error.message || 'Failed to delete audience');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: audienceKeys.all });
      toast.success('Audience deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
