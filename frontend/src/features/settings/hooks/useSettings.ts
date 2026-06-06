"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutateFunction,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { TenantSettings } from "../types";

export interface UseSettingsReturn {
  settings: TenantSettings | undefined;
  isLoading: boolean;
  error: Error | null;
  updateSettings: UseMutateFunction<TenantSettings, Error, Partial<TenantSettings>>;
  isUpdating: boolean;
}

function useSettings(): UseSettingsReturn {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => {
      const response = await api.get<TenantSettings>("/api/tenant/settings");
      if (response.success) return response.data;
      throw new Error(response.error?.message || "Failed to fetch settings");
    },
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<TenantSettings>) => {
      const response = await api.patch<TenantSettings>("/api/tenant/settings", updates);
      if (response.success) return response.data;
      throw new Error(response.error?.message || "Failed to update settings");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast.success("Settings updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateSettings: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}
