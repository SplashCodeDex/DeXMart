import { describe, it, expect } from "vitest";
import { AgentSchema, AgentTemplateSchema, BillingContextSchema } from "./types";

describe("Agent Schemas", () => {
  describe("AgentSchema", () => {
    it("should validate a valid agent object", () => {
      const validAgent = {
        id: "agent_123",
        name: "Sales Pro",
        iconName: "shopping-cart",
        systemPrompt: "You are a helpful sales assistant.",
        model: "gemini-1.5-pro",
        skills: ["web_search", "file_analysis"],
        plan: "pro",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = AgentSchema.safeParse(validAgent);
      expect(result.success).toBe(true);
    });

    it("should fail on missing required fields", () => {
      const invalidAgent = {
        name: "Incomplete Agent",
      };
      const result = AgentSchema.safeParse(invalidAgent);
      expect(result.success).toBe(false);
    });
  });

  describe("AgentTemplateSchema", () => {
    it("should validate a valid template object", () => {
      const validTemplate = {
        id: "template_sales",
        title: "Sales Pro",
        description: "Optimized for lead conversion.",
        iconName: "shopping-cart",
        defaultSystemPrompt: "Act as a sales professional...",
        suggestedModel: "gemini-1.5-pro",
        requiredTier: "starter",
      };
      const result = AgentTemplateSchema.safeParse(validTemplate);
      expect(result.success).toBe(true);
    });
  });

  describe("BillingContextSchema", () => {
    it("should validate valid billing data", () => {
      const validBilling = {
        plan: "starter",
        agentCount: 0,
        agentLimit: 1,
        channelCount: 0,
        channelLimit: 1,
      };
      const result = BillingContextSchema.safeParse(validBilling);
      expect(result.success).toBe(true);
    });

    it("should reject invalid plan tiers", () => {
      const invalidBilling = {
        plan: "super-pro", // Not a valid tier
        agentCount: 0,
        agentLimit: 1,
        channelCount: 0,
        channelLimit: 1,
      };
      const result = BillingContextSchema.safeParse(invalidBilling);
      expect(result.success).toBe(false);
    });
  });
});
