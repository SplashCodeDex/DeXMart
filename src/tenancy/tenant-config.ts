/**
 * Tenant Configuration Service
 *
 * Manages tenant-specific settings stored in Firestore.
 * This is the proper place for user-configurable settings,
 * NOT environment variables.
 *
 * Configuration Hierarchy:
 * 1. Infrastructure (.env) - Platform operator only
 * 2. Platform Defaults (code) - Fallback values
 * 3. Tenant Settings (Firestore) - Customer controlled
 * 4. Channel Settings (Firestore) - Per-channel overrides
 */

import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';
import { OpenClawGateway } from './openClawGateway.js';
import {
    TenantSettings,
    TenantSettingsSchema,
    ChannelConfig,
    ChannelConfigSchema,
    DEFAULT_TENANT_SETTINGS,
    DEFAULT_CHANNEL_CONFIG,
} from '../types/tenantConfig.js';
import type { Result, Channel, Agent } from '../types/contracts.js';

// =============================================================================
// TenantConfigService
// =============================================================================

export class TenantConfigService {
    private static instance: TenantConfigService;

    // In-memory cache for frequently accessed settings
    private settingsCache: Map<string, { data: TenantSettings; expiry: number }> = new Map();
    private channelConfigCache: Map<string, { data: ChannelConfig; expiry: number }> = new Map();
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    private constructor() { }

    public static getInstance(): TenantConfigService {
        if (!TenantConfigService.instance) {
            TenantConfigService.instance = new TenantConfigService();
        }
        return TenantConfigService.instance;
    }

    // ===========================================================================
    // Tenant Settings
    // ===========================================================================

    /**
     * Get tenant settings from Firestore with caching.
     * Falls back to defaults if not found.
     */
    async getTenantSettings(tenantId: string): Promise<Result<TenantSettings>> {
        try {
            // Check cache first
            const cached = this.settingsCache.get(tenantId);
            if (cached && Date.now() < cached.expiry) {
                return { success: true, data: cached.data };
            }

            // Fetch from Firestore
            const docRef = db.collection('tenants').doc(tenantId).collection('settings').doc('general');
            const doc = await docRef.get();

            let settings: TenantSettings;
            if (doc.exists) {
                // Validate and parse
                const rawData = doc.data();
                settings = TenantSettingsSchema.parse({
                    ...DEFAULT_TENANT_SETTINGS,
                    ...rawData,
                });
            } else {
                // Return defaults for new tenant
                settings = TenantSettingsSchema.parse(DEFAULT_TENANT_SETTINGS);
            }

            // Update cache
            this.settingsCache.set(tenantId, {
                data: settings,
                expiry: Date.now() + this.CACHE_TTL_MS,
            });

            return { success: true, data: settings };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`[TenantConfigService] Failed to get tenant settings for ${tenantId}:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Update tenant settings in Firestore.
     */
    async updateTenantSettings(
        tenantId: string,
        updates: Partial<TenantSettings>,
        metadata: { actor: string; ip?: string } = { actor: 'system' }
    ): Promise<Result<TenantSettings>> {
        try {
            const docRef = db.collection('tenants').doc(tenantId).collection('settings').doc('general');

            // 1. Fetch current settings
            const currentResult = await this.getTenantSettings(tenantId);
            if (!currentResult.success) {
                return currentResult;
            }

            // 2. Merge and validate for Firestore
            const merged = TenantSettingsSchema.parse({
                ...currentResult.data,
                ...updates,
                updatedAt: new Date(),
            });

            // 3. FUSION: Patch OpenClaw Engine (Primary Source of Truth)
            try {
                const gateway = OpenClawGateway.getInstance();
                if (gateway.isInitialized()) {
                    await gateway.patchConfig(tenantId, {
                        acp: {
                            tenantSettings: {
                                [tenantId]: merged
                            }
                        }
                    }, metadata);
                }
            } catch (fusionError) {
                logger.error(`[TenantConfigService] Fusion patch failed for ${tenantId}:`, fusionError);
                // We continue to Firestore sync even if engine patch fails, 
                // but we might want to flag this for retry later.
            }

            // 4. Persistence: Sync to Firestore (Read Replica)
            await docRef.set(merged, { merge: true });

            // Invalidate cache
            this.settingsCache.delete(tenantId);

            logger.info(`[TenantConfigService] Updated settings for tenant ${tenantId}`);
            return { success: true, data: merged };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`[TenantConfigService] Failed to update tenant settings:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Initialize default settings for a new tenant.
     */
    async initializeTenantSettings(
        tenantId: string,
        ownerNumber: string
    ): Promise<Result<TenantSettings>> {
        try {
            const settings = TenantSettingsSchema.parse({
                ...DEFAULT_TENANT_SETTINGS,
                ownerNumber,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const docRef = db.collection('tenants').doc(tenantId).collection('settings').doc('general');
            await docRef.set(settings);

            // 3. FUSION: Patch OpenClaw Engine
            try {
                const gateway = OpenClawGateway.getInstance();
                if (gateway.isInitialized()) {
                    await gateway.patchConfig(tenantId, {
                        acp: {
                            tenantSettings: {
                                [tenantId]: settings
                            }
                        }
                    }, { actor: 'system-init' });
                }
            } catch (fusionError) {
                logger.error(`[TenantConfigService] Fusion initialization failed for ${tenantId}:`, fusionError);
            }

            logger.info(`[TenantConfigService] Initialized settings for new tenant ${tenantId}`);
            return { success: true, data: settings };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`[TenantConfigService] Failed to initialize tenant settings:`, err);
            return { success: false, error: err };
        }
    }

    // ===========================================================================
    // Channel Configuration
    // ===========================================================================

    /**
     * Get channel configuration from Firestore.
     */
    async getChannelConfig(tenantId: string, channelId: string, agentId?: string): Promise<Result<ChannelConfig>> {
        try {
            const cacheKey = agentId ? `${tenantId}:${agentId}:${channelId}` : `${tenantId}:${channelId}`;

            // Check cache
            const cached = this.channelConfigCache.get(cacheKey);
            if (cached && Date.now() < cached.expiry) {
                return { success: true, data: cached.data };
            }

            // Fetch from Firestore
            const docRef = agentId
                ? db.collection('tenants').doc(tenantId).collection('agents').doc(agentId).collection('channels').doc(channelId)
                : db.collection('tenants').doc(tenantId).collection('channels').doc(channelId);
            
            const doc = await docRef.get();

            let config: ChannelConfig;
            if (doc.exists) {
                const rawData = doc.data();
                config = ChannelConfigSchema.parse({
                    ...DEFAULT_CHANNEL_CONFIG,
                    ...rawData,
                });
            } else {
                // Return defaults
                config = ChannelConfigSchema.parse(DEFAULT_CHANNEL_CONFIG);
            }

            // Update cache
            this.channelConfigCache.set(cacheKey, {
                data: config,
                expiry: Date.now() + this.CACHE_TTL_MS,
            });

            return { success: true, data: config };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`[TenantConfigService] Failed to get channel config:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Update channel configuration.
     */
    async updateChannelConfig(
        tenantId: string,
        channelId: string,
        updates: Partial<ChannelConfig>,
        agentId?: string
    ): Promise<Result<ChannelConfig>> {
        try {
            const docRef = agentId
                ? db.collection('tenants').doc(tenantId).collection('agents').doc(agentId).collection('channels').doc(channelId)
                : db.collection('tenants').doc(tenantId).collection('channels').doc(channelId);

            // Get current config
            const currentResult = await this.getChannelConfig(tenantId, channelId, agentId);
            if (!currentResult.success) {
                return currentResult;
            }

            // Merge and validate
            const merged = ChannelConfigSchema.parse({
                ...currentResult.data,
                ...updates,
                updatedAt: new Date(),
            });

            // Save to Firestore
            await docRef.set(merged, { merge: true });

            // Invalidate cache
            const cacheKey = agentId ? `${tenantId}:${agentId}:${channelId}` : `${tenantId}:${channelId}`;
            this.channelConfigCache.delete(cacheKey);

            logger.info(`[TenantConfigService] Updated config for channel ${channelId}`);
            return { success: true, data: merged };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`[TenantConfigService] Failed to update channel config:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Resolves the configuration for a specific Channel by merging it with its assigned Agent.
     */
    async resolveAgentChannelConfig(tenantId: string, channelId: string, agentId?: string): Promise<Result<ChannelConfig>> {
        try {
            const cacheKey = agentId ? `resolved:${tenantId}:${agentId}:${channelId}` : `resolved:${tenantId}:${channelId}`;

            // Check cache
            const cached = this.channelConfigCache.get(cacheKey);
            if (cached && Date.now() < cached.expiry) {
                return { success: true, data: cached.data };
            }

            // 1. Fetch Channel
            const channelRef = agentId
                ? db.collection('tenants').doc(tenantId).collection('agents').doc(agentId).collection('channels').doc(channelId)
                : db.collection('tenants').doc(tenantId).collection('channels').doc(channelId);
            
            const channelDoc = await channelRef.get();
            if (!channelDoc.exists) {
                return { success: false, error: new Error(`Channel ${channelId} not found`) };
            }
            const channelData = channelDoc.data() as Channel;

            // 2. Fetch Agent
            const effectiveAgentId = agentId || channelData.assignedAgentId;
            if (!effectiveAgentId) {
                return { success: false, error: new Error(`Channel ${channelId} has no assigned Agent`) };
            }

            const agentRef = db.collection('tenants').doc(tenantId).collection('agents').doc(effectiveAgentId);
            const agentDoc = await agentRef.get();
            if (!agentDoc.exists) {
                return { success: false, error: new Error(`Agent ${effectiveAgentId} not found`) };
            }
            const agentData = agentDoc.data() as Agent;

            // 3. Merge into ChannelConfig shape
            // Intelligence (prefix, personality) comes from Agent
            // Connectivity (status, phone) comes from Channel
            const baseConfig = {
                ...DEFAULT_CHANNEL_CONFIG,
                name: channelData.name || agentData.name,
                phoneNumber: channelData.phoneNumber || undefined,
                aiPersonality: agentData.personality || undefined,
                aiEnabled: true, // Agents are always AI enabled
                status: channelData.status === 'connected' ? 'online' : 'offline',
                ...(agentData.metadata || {}),
                ...(channelData.config || {}),
                updatedAt: new Date(),
            };

            // Validate against ChannelConfigSchema
            const resolvedConfig = ChannelConfigSchema.parse(baseConfig);

            // Update cache
            this.channelConfigCache.set(cacheKey, {
                data: resolvedConfig,
                expiry: Date.now() + this.CACHE_TTL_MS,
            });

            return { success: true, data: resolvedConfig };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`[TenantConfigService] Failed to resolve Agent/Channel config for ${channelId}:`, err);
            return { success: false, error: err };
        }
    }

    // ===========================================================================
    // Helper Methods
    // ===========================================================================

    /**
     * Get the owner number for a tenant (from Firestore, not env).
     */
    async getOwnerNumber(tenantId: string): Promise<string | null> {
        const result = await this.getTenantSettings(tenantId);
        if (result.success) {
            return result.data.ownerNumber ?? null;
        }
        return null;
    }

    /**
   * Check if a feature is enabled for a tenant.
   * Only checks boolean features (not maxChannels which is a number).
   */
    async isFeatureEnabled(
        tenantId: string,
        feature: 'aiEnabled' | 'campaignsEnabled' | 'analyticsEnabled' | 'webhooksEnabled'
    ): Promise<boolean> {
        const result = await this.getTenantSettings(tenantId);
        if (result.success && result.data.features) {
            return result.data.features[feature] ?? false;
        }
        return false;
    }

    /**
     * Clear all caches (useful for testing).
     */
    clearCache(): void {
        this.settingsCache.clear();
        this.channelConfigCache.clear();
    }
}

// Export singleton instance
export const tenantConfigService = TenantConfigService.getInstance();
export default tenantConfigService;
