'use client';

import { useQuery } from '@tanstack/react-query';

import { api, API_ENDPOINTS } from '@/lib/api';
import { isApiSuccess } from '@/types';

export interface SubscriptionData {
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const billingKeys = {
  all: ['billing'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
};

export interface UseSubscriptionReturn {
  subscription: SubscriptionData | undefined;
  isLoading: boolean;
  error: Error | null;
  limits: { maxBots: number };
  isAtLimit: (currentCount: number) => boolean;
}

export function useSubscription(): UseSubscriptionReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: async () => {
      const response = await api.get<SubscriptionData>(API_ENDPOINTS.BILLING.SUBSCRIPTION);
      if (isApiSuccess(response)) {
        return response.data;
      }
      throw new Error(response.error.message);
    },
  });

  const planLimits = {
    starter: { maxBots: 1 },
    pro: { maxBots: 3 },
    enterprise: { maxBots: 10 },
  };

  const currentLimits = data ? planLimits[data.plan] : planLimits.starter;

  return {
    subscription: data,
    isLoading,
    error,
    limits: currentLimits,
    isAtLimit: (currentCount: number) => currentCount >= (currentLimits?.maxBots || 1),
  };
}
