/**
 * Billing Schemas (Backend)
 *
 * Zero-Trust Data Layer: All IO must be validated via Zod
 */

import { z } from "zod";

// Plan Types
export const PlanSchema = z.enum(["starter", "pro", "enterprise"]);
export type Plan = z.infer<typeof PlanSchema>;

export const SubscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// Request Schemas
export const CreateCheckoutSessionRequestSchema = z.object({
  planId: PlanSchema,
  interval: z.enum(["month", "year"]),
});
export type CreateCheckoutSessionRequest = z.infer<typeof CreateCheckoutSessionRequestSchema>;

// Response Schemas
export const SubscriptionInfoResponseSchema = z.object({
  plan: PlanSchema,
  status: SubscriptionStatusSchema,
  trialEndsAt: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
});
export type SubscriptionInfoResponse = z.infer<typeof SubscriptionInfoResponseSchema>;

export const CheckoutSessionResponseSchema = z.object({
  url: z.string().url(),
});
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponseSchema>;

export const InvoiceStatusSchema = z.enum(["paid", "pending", "failed"]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const InvoiceResponseSchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number().int().nonnegative(),
  status: InvoiceStatusSchema,
  invoiceUrl: z.string(),
  description: z.string(),
});
export type InvoiceResponse = z.infer<typeof InvoiceResponseSchema>;

export const PaymentMethodResponseSchema = z.object({
  id: z.string(),
  brand: z.string(),
  last4: z.string().length(4),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(2024),
  isDefault: z.boolean(),
});
export type PaymentMethodResponse = z.infer<typeof PaymentMethodResponseSchema>;
