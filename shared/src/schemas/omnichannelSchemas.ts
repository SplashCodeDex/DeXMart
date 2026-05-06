import { z } from "zod";

/**
 * Zod schemas for Omnichannel API validation
 * Adheres to DeXMart 2026 Rule 1 (Zero-Trust Data Layer)
 */

export const getAgentIdentitySchema = z.object({
  params: z.object({
    id: z.string().min(1, "Agent ID is required"),
  }),
});

export const usageQuerySchema = z.object({
  query: z.object({
    days: z
      .preprocess((val) => {
        if (val === undefined || val === null || val === "") return 30;
        const parsed = parseInt(val as string, 10);
        return isNaN(parsed) ? 30 : parsed;
      }, z.number().int().positive().default(30))
      .optional(),
  }),
});

export const sessionLogsParamsSchema = z.object({
  params: z.object({
    key: z.string().min(1, "Session key is required"),
  }),
});

export const agentIdentityResponseSchema = z.object({
  agentId: z.string(),
  name: z.string(),
  avatar: z.string().optional(),
  emoji: z.string().optional(), // Kept for DB compatibility but will be filtered in UI
  linkedChannels: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum([
          "whatsapp",
          "telegram",
          "discord",
          "slack",
          "signal",
          "imessage",
          "custom",
          "irc",
          "googlechat",
        ]),
        status: z.enum([
          "connected",
          "disconnected",
          "connecting",
          "qr_pending",
          "error",
          "archived",
          "initializing",
          "banned",
          "logged_out",
          "reconnect_exhausted",
        ]),
        account: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

export type AgentIdentityResponse = z.infer<typeof agentIdentityResponseSchema>;

export const toggleSkillSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Skill ID is required"),
  }),
  body: z.object({
    enabled: z.boolean(),
  }),
});

export type ToggleSkillRequest = z.infer<typeof toggleSkillSchema>;
