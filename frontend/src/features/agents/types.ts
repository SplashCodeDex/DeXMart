import { z } from 'zod';

/**
 * Valid plan tiers for the platform.
 */
const PlanSchema = z.enum(['starter', 'pro', 'enterprise']);
export type PlanTier = z.infer<typeof PlanSchema>;

/**
 * Supported AI models.
 */
const AIModelSchema = z.enum([
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gpt-4o',
    'claude-3-5-sonnet'
]);
export type AIModel = z.infer<typeof AIModelSchema>;

/**
 * Unified Agent schema representing the "Brain".
 */
export const AgentSchema = z.object({
    id: z.string(),
    name: z.string().min(1, 'Name is required'),
    iconName: z.string().default('bot'),
    systemPrompt: z.string().min(1, 'System prompt is required'),
    model: AIModelSchema,
    skills: z.array(z.string()).default([]),
    boundChannels: z.array(z.string()).default([]),
    plan: z.preprocess((val, ctx) => {
        if (typeof val === 'string' && ['starter', 'pro', 'enterprise'].includes(val.toLowerCase())) return val.toLowerCase();
        const input = (ctx as { parent?: Record<string, unknown> }).parent || {};
        const legacyVal = input.planTier;
        if (typeof legacyVal === 'string' && ['starter', 'pro', 'enterprise'].includes(legacyVal.toLowerCase())) return legacyVal.toLowerCase();
        return undefined;
    }, PlanSchema.default('starter')),
    status: z.enum(['active', 'inactive', 'archived']).default('active'),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type Agent = z.infer<typeof AgentSchema>;

/**
 * Schema for Agent Templates to simplify onboarding.
 */
export const AgentTemplateSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    iconName: z.string(),
    defaultSystemPrompt: z.string(),
    suggestedModel: AIModelSchema,
    requiredTier: PlanSchema,
});

export type AgentTemplate = z.infer<typeof AgentTemplateSchema>;

/**
 * Billing context for enforcing tier limits.
 */
export const BillingContextSchema = z.object({
    plan: PlanSchema,
    agentCount: z.number().int().min(0),
    agentLimit: z.number().int().min(0),
    channelCount: z.number().int().min(0),
    channelLimit: z.number().int().min(0),
});

export type BillingContext = z.infer<typeof BillingContextSchema>;
