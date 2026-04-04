/**
 * Universal API Key Rotation Manager (Adapter)
 * Wraps @codedex/api-key-manager for backward compatibility in DeXMart.
 *
 * @module lib/apiKeyManager
 */

import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiKeyManager as UniversalManager, ErrorClassification, LatencyStrategy } from '@splashcodex/api-key-manager';
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import logger from '../utils/logger.js';
import type { Result } from '../types/contracts.js';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    STATE_FILE: join(tmpdir(), 'DeXMart_api_key_state_v2.json'),
} as const;

// ============================================================================
// Types (Re-exported or adapted)
// ============================================================================

interface ApiKeyManagerStats {
    readonly totalKeys: number;
    readonly healthyKeys: number;
    readonly openCircuits: number;
    readonly halfOpenCircuits: number;
    readonly totalRequests: number;
    readonly totalSuccesses: number;
}

// ============================================================================
// Storage Adapter
// ============================================================================

class LocalFileStorage {
    getItem(key: string): string | null {
        try {
            if (existsSync(CONFIG.STATE_FILE)) {
                return readFileSync(CONFIG.STATE_FILE, 'utf-8');
            }
        } catch (error) {
            logger.warn('[ApiKeyManager] Failed to read state file:', error);
        }
        return null;
    }

    setItem(key: string, value: string): void {
        try {
            const dir = dirname(CONFIG.STATE_FILE);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(CONFIG.STATE_FILE, value, 'utf-8');
        } catch (error) {
            logger.warn('[ApiKeyManager] Failed to write state file:', error);
        }
    }

    static clearState(): void {
        try {
            if (existsSync(CONFIG.STATE_FILE)) {
                unlinkSync(CONFIG.STATE_FILE);
                logger.info('[ApiKeyManager] Cleared stale key state file for fresh start.');
            }
        } catch (error) {
            logger.warn('[ApiKeyManager] Failed to clear stale state file:', error);
        }
    }
}

// ============================================================================
// ApiKeyManager Class (Adapter)
// ============================================================================

export class ApiKeyManager {
    private static instance: ApiKeyManager | null = null;
    private manager: UniversalManager;

    private constructor(apiKeys: string[]) {
        // Clear stale state so dead keys from a previous session don't block startup.
        LocalFileStorage.clearState();
        const storage = new LocalFileStorage();
        this.manager = new UniversalManager(apiKeys, {
            storage,
            strategy: new LatencyStrategy(), // Pick lowest average latency
            concurrency: 20, // Allow more concurrent calls in backend
            semanticCache: {
                threshold: 0.92, // 92% similarity for better hit rate
                getEmbedding: async (text: string) => {
                    // Dynamic import to break circular dependency with embeddingService
                    const { EmbeddingService } = await import('../services/embeddingService.js');
                    const result = await EmbeddingService.getInstance();
                    if (!result.success) throw result.error;
                    const embedResult = await result.data.generateEmbedding(text);
                    if (!embedResult.success) throw embedResult.error;
                    return embedResult.data;
                }
            }
        });

        this.wireEvents();
        this.setupHealthChecks();
        logger.info(`[ApiKeyManager] Initialized Universal Manager with ${apiKeys.length} keys (Semantic Cache Enabled)`);
    }

    /**
     * Set up proactive health checks for automatic key recovery.
     */
    private setupHealthChecks(): void {
        this.manager.setHealthCheck(async (key) => {
            try {
                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                await model.generateContent('ping');
                return true;
            } catch (error) {
                return false;
            }
        });

        // Start checking every 5 minutes
        this.manager.startHealthChecks(300_000);
    }

    /**
     * Wire up library events to system logger.
     */
    private wireEvents(): void {
        this.manager.on('keyDead', (key) => logger.error(`[ApiKeyManager] Key PERMANENTLY DEAD: ...${key.slice(-4)}`));
        this.manager.on('circuitOpen', (key) => logger.warn(`[ApiKeyManager] Circuit OPEN (cooldown): ...${key.slice(-4)}`));
        this.manager.on('keyRecovered', (key) => logger.info(`[ApiKeyManager] Key RECOVERED: ...${key.slice(-4)}`));
        this.manager.on('retry', (key, attempt, delay) => logger.info(`[ApiKeyManager] Retrying with ...${key.slice(-4)} (Attempt ${attempt}, Delay ${delay}ms)`));
        this.manager.on('fallback', (reason) => logger.warn(`[ApiKeyManager] Triggering FALLBACK: ${reason}`));
        this.manager.on('allKeysExhausted', () => logger.error('[ApiKeyManager] ALL KEYS EXHAUSTED! No fallback available.'));
        this.manager.on('bulkheadRejected', () => logger.warn('[ApiKeyManager] Bulkhead rejected request (concurrency limit reached)'));
    }

    /**
     * Execute a function with API key rotation, retries, and timeouts.
     */
    public async execute<T>(
        fn: (key: string, signal?: AbortSignal) => Promise<T>,
        options?: { maxRetries?: number; timeoutMs?: number; finishReason?: string; prompt?: string }
    ): Promise<T> {
        return this.manager.execute(fn, options);
    }

    /**
     * Reset the singleton instance (primarily for testing)
     */
    public static resetInstance(): void {
        ApiKeyManager.instance = null;
    }

    /**
     * Get or create the singleton instance of ApiKeyManager.
     * Reads API keys from GOOGLE_GEMINI_API_KEY environment variable.
     */
    public static getInstance(): Result<ApiKeyManager> {
        if (ApiKeyManager.instance) {
            return { success: true, data: ApiKeyManager.instance };
        }

        const envValue = process.env.GOOGLE_GEMINI_API_KEY;
        if (!envValue) {
            logger.warn('[ApiKeyManager] GOOGLE_GEMINI_API_KEY is not set. AI features will be disabled.');
            ApiKeyManager.instance = new ApiKeyManager([]);
            return { success: true, data: ApiKeyManager.instance };
        }

        try {
            // Parse keys (handle JSON array or single string)
            let keys: string[] = [];
            const trimmed = envValue.trim();
            if (trimmed.startsWith('[')) {
                keys = JSON.parse(trimmed);
            } else {
                keys = [trimmed];
            }

            if (keys.length === 0) {
                logger.warn('[ApiKeyManager] GOOGLE_GEMINI_API_KEY is empty.');
                ApiKeyManager.instance = new ApiKeyManager([]);
                return { success: true, data: ApiKeyManager.instance };
            }

            ApiKeyManager.instance = new ApiKeyManager(keys);
            return { success: true, data: ApiKeyManager.instance };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('[ApiKeyManager] Failed to parse API keys:', err);
            return { success: false, error: err };
        }
    }

    /**
     * Get the best available API key.
     */
    public getKey(): Result<string> {
        const key = this.manager.getKey();
        if (!key) {
            return {
                success: false,
                error: new Error('No API keys available (all exhausted or dead)'),
            };
        }
        return { success: true, data: key };
    }

    /**
     * Get the total number of keys in the pool.
     */
    public getKeyCount(): number {
        return this.manager.getKeyCount();
    }

    /**
     * Get statistics about the key pool.
     * Adapts the new stats format to the old expected interface if needed,
     * or returns the new format if compatible.
     */
    public getStats(): ApiKeyManagerStats {
        const stats = this.manager.getStats();
        // Map new stats to old interface
        return {
            totalKeys: stats.total,
            healthyKeys: stats.healthy,
            openCircuits: stats.cooling, // Approximation
            halfOpenCircuits: 0, // Detail lost in summary
            totalRequests: 0, // Not exposed in simple stats
            totalSuccesses: 0, // Not exposed in simple stats
        };
    }

    /**
     * Mark a key as successful.
     */
    public markSuccess(key: string): void {
        this.manager.markSuccess(key);
    }

    /**
     * Mark a key as failed.
     * Adapts the old (key, isQuota) signature to the new classification system.
     */
    public markFailed(key: string, isQuota: boolean = false): void {
        // Use the legacy compatibility method from the new manager
        this.manager.markFailedLegacy(key, isQuota);
    }

    /**
     * Mark a key as failed using automatic error classification.
     * This leverages the robust classification logic from the library.
     */
    public markFailedWithError(key: string, error: unknown): void {
        const classification = this.manager.classifyError(error);
        if (classification.markKeyFailed) {
            logger.warn(`[ApiKeyManager] Marking key failed: ${classification.type} (Retryable: ${classification.retryable})`);
            this.manager.markFailed(key, classification);
        }
    }
}

// ============================================================================
// Helper Functions (Re-exported)
// ============================================================================

export function isQuotaError(error: unknown): boolean {
    // We can use the library's internal logic via a helper if we exposed it,
    // otherwise keep the local implementation or rely on the manager's classification.
    // For now, keeping the local implementation is safest to avoid import issues if not exposed.
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes('429') ||
            message.includes('quota') ||
            message.includes('rate limit') ||
            message.includes('resource exhausted') ||
            message.includes('too many requests')
        );
    }
    return false;
}
