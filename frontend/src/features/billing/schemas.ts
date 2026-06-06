/**
 * Billing Feature Zod Schemas
 *
 * Zero-Trust Data Layer: All external data must be validated via Zod
 */

import { z } from 'zod';

// Plan Types
const PlanSchema = z.enum(['starter', 'pro', 'enterprise']);
export type PlanTier = z.infer<typeof PlanSchema>;

const SubscriptionStatusSchema = z.enum([
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// Subscription Info Schema
export const SubscriptionInfoSchema = z.object({
  plan: z.preprocess((val, ctx) => {
    if (typeof val === 'string' && ['starter', 'pro', 'enterprise'].includes(val.toLowerCase())) return val.toLowerCase();
    const input = (ctx as { parent?: Record<string, unknown> }).parent || {};
    const legacyVal = input.planTier;
    if (typeof legacyVal === 'string' && ['starter', 'pro', 'enterprise'].includes(legacyVal.toLowerCase())) return legacyVal.toLowerCase();
    return undefined;
  }, PlanSchema.default('starter')),
  status: SubscriptionStatusSchema,
  trialEndsAt: z.string().datetime().nullable(),
  currentPeriodEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
});
export type SubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>;

// Checkout Session Response Schema
const CheckoutSessionResponseSchema = z.object({
  url: z.string().url(),
});
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponseSchema>;

// Invoice Schema
const InvoiceStatusSchema = z.enum(['paid', 'pending', 'failed']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

const InvoiceSchema = z.object({
  id: z.string(),
  date: z.string().datetime(),
  amount: z.number().int().nonnegative(),
  status: InvoiceStatusSchema,
  invoiceUrl: z.string().url(),
  description: z.string(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const InvoiceListSchema = z.array(InvoiceSchema);

// Payment Method Schema
const PaymentMethodSchema = z.object({
  id: z.string(),
  brand: z.string(),
  last4: z.string().length(4),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(2024),
  isDefault: z.boolean(),
});
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentMethodListSchema = z.array(PaymentMethodSchema);

// Request Schemas
const CreateCheckoutSessionRequestSchema = z.object({
  planId: PlanSchema,
  interval: z.enum(['month', 'year']),
});
export type CreateCheckoutSessionRequest = z.infer<typeof CreateCheckoutSessionRequestSchema>;
