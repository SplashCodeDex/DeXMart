import { z } from "zod";

/**
 * Zod schemas for Webhook API validation
 */

export const deleteWebhookSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Webhook ID is required"),
  }),
});

export type DeleteWebhookRequest = z.infer<typeof deleteWebhookSchema>;
