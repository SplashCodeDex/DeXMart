import { CheckoutSessionResponse, SubscriptionInfo } from "@/types/billing";
import { api } from "./client";

export const billingApi = {
  createCheckoutSession: async (planId: string, interval: "month" | "year") => {
    const response = await api.post<CheckoutSessionResponse>("/api/billing/checkout", {
      planId,
      interval,
    });
    if (!response.success) {
      throw new Error(response.error.message);
    }
    return response.data;
  },

  getSubscription: async () => {
    const response = await api.get<SubscriptionInfo>("/api/billing/subscription");
    if (!response.success) {
      throw new Error(response.error.message);
    }
    return response.data;
  },
};
