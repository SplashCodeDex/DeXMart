/**
 * Unit tests for ApiKeyManager
 *
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fs before importing ApiKeyManager
vi.mock('fs', () => ({
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    existsSync: vi.fn(() => false),
}));

// Mock the logger
vi.mock('../utils/logger.js', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('ApiKeyManager', () => {
    const originalEnv = process.env.GOOGLE_GEMINI_API_KEY;

    beforeEach(() => {
        // Reset module state between tests
        vi.resetModules();
    });

    afterEach(() => {
        // Restore original env
        if (originalEnv) {
            process.env.GOOGLE_GEMINI_API_KEY = originalEnv;
        } else {
            delete process.env.GOOGLE_GEMINI_API_KEY;
        }
    });

    describe('getInstance', () => {
        it('should return a disabled instance when env var is not set', async () => {
            delete process.env.GOOGLE_GEMINI_API_KEY;

            // Dynamic import to get fresh module
            const { ApiKeyManager } = await import('./apiKeyManager.js');
            ApiKeyManager.resetInstance();

            const result = ApiKeyManager.getInstance();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.getKeyCount()).toBe(0);
            }
        });

        it('should parse single key string', async () => {
            process.env.GOOGLE_GEMINI_API_KEY = 'test-key-123';

            const { ApiKeyManager } = await import('./apiKeyManager.js');
            ApiKeyManager.resetInstance();

            const result = ApiKeyManager.getInstance();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.getKeyCount()).toBe(1);
            }
        });

        it('should parse JSON array of keys', async () => {
            process.env.GOOGLE_GEMINI_API_KEY = '["key1", "key2", "key3"]';

            const { ApiKeyManager } = await import('./apiKeyManager.js');
            ApiKeyManager.resetInstance();

            const result = ApiKeyManager.getInstance();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.getKeyCount()).toBe(3);
            }
        });

        it('should return same instance on subsequent calls', async () => {
            process.env.GOOGLE_GEMINI_API_KEY = 'test-key';

            const { ApiKeyManager } = await import('./apiKeyManager.js');
            ApiKeyManager.resetInstance();

            const result1 = ApiKeyManager.getInstance();
            const result2 = ApiKeyManager.getInstance();

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            if (result1.success && result2.success) {
                expect(result1.data).toBe(result2.data);
            }
        });
    });

    describe('getKey', () => {
        it('should return a key from the pool', async () => {
            process.env.GOOGLE_GEMINI_API_KEY = '["key1", "key2"]';

            const { ApiKeyManager } = await import('./apiKeyManager.js');
            ApiKeyManager.resetInstance();

            const managerResult = ApiKeyManager.getInstance();
            expect(managerResult.success).toBe(true);
            if (!managerResult.success) return;

            const keyResult = managerResult.data.getKey();

            expect(keyResult.success).toBe(true);
            if (keyResult.success) {
                expect(['key1', 'key2']).toContain(keyResult.data);
            }
        });

        it('should rotate to next key when current key fails', async () => {
            process.env.GOOGLE_GEMINI_API_KEY = '["key1", "key2"]';

            const { ApiKeyManager } = await import('./apiKeyManager.js');
            ApiKeyManager.resetInstance();

            const managerResult = ApiKeyManager.getInstance();
            if (!managerResult.success) return;

            const manager = managerResult.data;

            // Get first key
            const key1Result = manager.getKey();
            expect(key1Result.success).toBe(true);
            if (!key1Result.success) return;
            const firstKey = key1Result.data;

            // Mark first key as failed (transient error opens circuit)
            for (let i = 0; i < 3; i++) {
                manager.markFailed(firstKey, {
                    type: 'TRANSIENT',
                    retryable: true,
                    cooldownMs: 60_000,
                    markKeyFailed: true,
                    markKeyDead: false,
                });
            }

            // Get second key - should be the OTHER key since first is on cooldown
            const key2Result = manager.getKey();
            expect(key2Result.success).toBe(true);
            if (!key2Result.success) return;

            expect(key2Result.data).not.toBe(firstKey);
        });
    });

    describe('markFailed', () => {
        it('should open circuit after max failures', async () => {
            process.env.GOOGLE_GEMINI_API_KEY = '["key1", "key2"]';

            const { ApiKeyManager } = await import('./apiKeyManager.js');
            ApiKeyManager.resetInstance();

            const managerResult = ApiKeyManager.getInstance();
            if (!managerResult.success) return;

            const manager = managerResult.data;
            const keyResult = manager.getKey();
            if (!keyResult.success) return;

            const key = keyResult.data;

            // Fail 5 times (MAX_CONSECUTIVE_FAILURES)
            for (let i = 0; i < 5; i++) {
                manager.markFailed(key, false);
            }

            const stats = manager.getStats();
            expect(stats.openCircuits).toBeGreaterThan(0);
        });

        it('should immediately open circuit on quota error', async () => {
            process.env.GOOGLE_GEMINI_API_KEY = '["key1", "key2"]';

            const { ApiKeyManager } = await import('./apiKeyManager.js');
            ApiKeyManager.resetInstance();

            const managerResult = ApiKeyManager.getInstance();
            if (!managerResult.success) return;

            const manager = managerResult.data;
            const keyResult = manager.getKey();
            if (!keyResult.success) return;

            const key = keyResult.data;

            // Single quota error should open circuit
            manager.markFailed(key, true);

            const stats = manager.getStats();
            expect(stats.openCircuits).toBe(1);
        });
    });

    describe('markSuccess', () => {
        it('should reset circuit to closed', async () => {
            process.env.GOOGLE_GEMINI_API_KEY = '["key1"]';

            const { ApiKeyManager } = await import('./apiKeyManager.js');
            ApiKeyManager.resetInstance();

            const managerResult = ApiKeyManager.getInstance();
            if (!managerResult.success) return;

            const manager = managerResult.data;
            const keyResult = manager.getKey();
            if (!keyResult.success) return;

            const key = keyResult.data;

            // Fail to open circuit
            manager.markFailed(key, true);
            expect(manager.getStats().openCircuits).toBe(1);

            // Success should close it (after HALF_OPEN transition)
            // Note: In real scenario, cooldown must expire first
            manager.markSuccess(key);
            expect(manager.getStats().healthyKeys).toBe(1);
        });
    });

    describe('isQuotaError helper', () => {
        it('should detect 429 errors', async () => {
            const { isQuotaError } = await import('./apiKeyManager.js');

            expect(isQuotaError(new Error('429 Too Many Requests'))).toBe(true);
            expect(isQuotaError(new Error('Resource exhausted'))).toBe(true);
            expect(isQuotaError(new Error('Quota exceeded'))).toBe(true);
            expect(isQuotaError(new Error('Rate limit reached'))).toBe(true);
        });

        it('should not detect non-quota errors', async () => {
            const { isQuotaError } = await import('./apiKeyManager.js');

            expect(isQuotaError(new Error('Internal Server Error'))).toBe(false);
            expect(isQuotaError(new Error('Network timeout'))).toBe(false);
        });
    });
});
