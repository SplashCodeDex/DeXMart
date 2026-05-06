import { z } from "zod";

/**
 * Result Type for Functional Error Handling (Contracts)
 */
export type ContractResult<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/**
 * Webhook Event Enum
 */
export const WebhookEventSchema = z.enum([
  "message.received",
  "message.sent",
  "channel.connected",
  "channel.disconnected",
  "channel.error",
  "campaign.completed",
  "flow.executed",
]);

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

/**
 * Webhook Schema
 */
export const WebhookSchema = z.object({
  id: z.string(),
  url: z.string().url({ message: "Invalid webhook URL format" }),
  events: z.array(WebhookEventSchema).min(1, { message: "At least one event must be selected" }),
  secret: z.string().min(16, { message: "Secret must be at least 16 characters for security" }),
  isActive: z.boolean().default(true),
  name: z.string().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type Webhook = z.infer<typeof WebhookSchema>;

/**
 * Tenant Settings Schema (stored in tenants/{tenantId}/settings/general)
 */
export const TenantSettingsSchema = z.object({
  // Owner Information
  ownerNumber: z.string().optional(),
  ownerName: z.string().optional(),
  organization: z.string().optional(),

  channelDefaults: z
    .object({
      prefix: z.array(z.string()).default([".", "!", "/"]),
      mode: z.enum(["public", "private", "group-only"]).default("public"),
      autoReconnect: z.boolean().default(true),
      cooldownMs: z.number().min(0).default(10000),
    })
    .default(() => ({
      prefix: [".", "!", "/"],
      mode: "public" as const,
      autoReconnect: true,
      cooldownMs: 10000,
    })),

  // Feature Toggles (based on subscription plan)
  features: z
    .object({
      aiEnabled: z.boolean().default(false),
      campaignsEnabled: z.boolean().default(false),
      analyticsEnabled: z.boolean().default(true),
      webhooksEnabled: z.boolean().default(false),
      maxChannels: z.number().min(1).default(1),
    })
    .default(() => ({
      aiEnabled: false,
      campaignsEnabled: false,
      analyticsEnabled: true,
      webhooksEnabled: false,
      maxChannels: 1,
    })),

  // Notification Preferences
  notifications: z
    .object({
      email: z.boolean().default(true),
      webhookUrl: z.string().url().optional(),
      notifyOnChannelDisconnect: z.boolean().default(true),
      notifyOnErrors: z.boolean().default(true),
    })
    .default(() => ({
      email: true,
      notifyOnChannelDisconnect: true,
      notifyOnErrors: true,
    })),

  // Metadata
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export type TenantSettings = z.infer<typeof TenantSettingsSchema>;
