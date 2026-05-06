import { z } from "zod";

/**
 * Zod schemas for Automation API validation
 */

export const toggleAutomationSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Automation ID is required"),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export type ToggleAutomationRequest = z.infer<typeof toggleAutomationSchema>;
