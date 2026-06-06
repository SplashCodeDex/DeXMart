import { z } from "zod";

/**
 * Webhook Event Types
 */
export const WEBHOOK_EVENTS = [
  "message.received",
  "message.sent",
  "channel.connected",
  "channel.disconnected",
  "channel.error",
  "campaign.completed",
  "flow.executed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Webhook Schema
 */
const WebhookSchema = z.object({
  id: z.string(),
  url: z.string().url({ message: "Invalid webhook URL format" }),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, { message: "At least one event must be selected" }),
  secret: z.string().min(16, { message: "Secret must be at least 16 characters" }),
  isActive: z.boolean().default(true),
  name: z.string().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

export type Webhook = z.infer<typeof WebhookSchema>;

/**
 * Webhook Form Schema (for creation)
 */
const WebhookFormSchema = WebhookSchema.omit({
  id: true,
  secret: true,
  createdAt: true,
  updatedAt: true,
});

export type WebhookFormData = z.infer<typeof WebhookFormSchema>;
