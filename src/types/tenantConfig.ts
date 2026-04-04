/**
 * Tenant Configuration Types
 *
 * These schemas define tenant-specific settings stored in Firestore,
 * NOT in environment variables. Each tenant controls their own configuration
 * via the dashboard.
 */

import { z } from 'zod';

// =============================================================================
// Tenant Settings Schema (stored in tenants/{tenantId}/settings/general)
// =============================================================================

export const TenantSettingsSchema = z.object({
    // Owner Information
    ownerNumber: z.string().min(10).describe('Primary WhatsApp number for this tenant').optional(),
    ownerName: z.string().optional(),
    organization: z.string().optional(),

    channelDefaults: z.object({
        prefix: z.array(z.string()).default(['.', '!', '/']),
        mode: z.enum(['public', 'private', 'group-only']).default('public'),
        autoReconnect: z.boolean().default(true),
        cooldownMs: z.number().min(0).default(10000),
    }).default(() => ({
        prefix: ['.', '!', '/'],
        mode: 'public' as const,
        autoReconnect: true,
        cooldownMs: 10000,
    })),

    // Feature Toggles (based on subscription plan)
    features: z.object({
        aiEnabled: z.boolean().default(false),
        campaignsEnabled: z.boolean().default(false),
        analyticsEnabled: z.boolean().default(true),
        webhooksEnabled: z.boolean().default(false),
        maxChannels: z.number().min(1).default(1),
    }).default(() => ({
        aiEnabled: false,
        campaignsEnabled: false,
        analyticsEnabled: true,
        webhooksEnabled: false,
        maxChannels: 1,
    })),

    // Notification Preferences
    notifications: z.object({
        email: z.boolean().default(true),
        webhookUrl: z.string().url().optional(),
        notifyOnChannelDisconnect: z.boolean().default(true),
        notifyOnErrors: z.boolean().default(true),
    }).default(() => ({
        email: true,
        notifyOnChannelDisconnect: true,
        notifyOnErrors: true,
    })),

    // Metadata
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

// =============================================================================
// Channel Configuration Schema (stored in tenants/{tenantId}/channels/{channelId})
// =============================================================================

export const ChannelConfigSchema = z.object({
    // Identity
    name: z.string().min(1).default('My Channel'),
    phoneNumber: z.string().optional(),

    // Behavior
    prefix: z.array(z.string()).default(['.', '!', '/']),
    mode: z.enum(['public', 'private', 'group-only']).default('public'),
    selfMode: z.boolean().default(false),
    alwaysOnline: z.boolean().default(true),
    antiCall: z.boolean().default(true),
    autoRead: z.boolean().default(true),
    autoMention: z.boolean().default(false),
    autoAiLabel: z.boolean().default(true),
    autoTypingCmd: z.boolean().default(true),

    // Automation
    autoReply: z.boolean().default(false),
    autoReplyMessage: z.string().optional(),
    welcomeMessage: z.string().optional(),

    // AI Configuration
    aiEnabled: z.boolean().default(false),
    aiPersonality: z.string().optional(),

    // Sticker Configuration
    stickerPackname: z.string().default('DeXMart Sticker Pack'),
    stickerAuthor: z.string().default('CodeDeX'),

    // Rate Limiting
    cooldownMs: z.number().min(0).default(10000),
    maxCommandsPerMinute: z.number().min(1).default(60),

    // Command Management
    disabledCommands: z.array(z.string()).default([]),

    // Status
    status: z.enum(['online', 'offline', 'connecting', 'error']).default('offline'),
    lastSeen: z.date().optional(),

    // Metadata
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

// =============================================================================
// Default Values (used when creating new tenants/bots)
// =============================================================================

export const DEFAULT_TENANT_SETTINGS: Partial<TenantSettings> = {
    channelDefaults: {
        prefix: ['.', '!', '/'],
        mode: 'public',
        autoReconnect: true,
        cooldownMs: 10000,
    },
    features: {
        aiEnabled: false,
        campaignsEnabled: false,
        analyticsEnabled: true,
        webhooksEnabled: false,
        maxChannels: 1,
    },
    notifications: {
        email: true,
        notifyOnChannelDisconnect: true,
        notifyOnErrors: true,
    },
    ownerNumber: '+1234567890',
};

export const DEFAULT_CHANNEL_CONFIG: Partial<ChannelConfig> = {
    name: 'My Channel',
    prefix: ['.', '!', '/'],
    mode: 'public',
    selfMode: false,
    alwaysOnline: true,
    antiCall: true,
    autoRead: true,
    autoMention: false,
    autoAiLabel: true,
    autoTypingCmd: true,
    autoReply: false,
    aiEnabled: false,
    stickerPackname: 'DeXMart Sticker Pack',
    stickerAuthor: 'CodeDeX',
    cooldownMs: 10000,
    maxCommandsPerMinute: 60,
    status: 'offline',
};
