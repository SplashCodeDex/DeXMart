/**
 * user-config.ts — DeXMart Fusion: User-Scoped Config Resolution (FR-1)
 *
 * OpenClaw's loadConfig() reads a single JSON5 file for one user (the app owner).
 * DeXMart serves millions of users (B2C, user = tenant). This module adds
 * loadConfigForUser() which resolves an OpenClawConfig scoped to a specific user
 * via a three-layer cache: in-memory → Redis → Firestore → base fallback.
 *
 * OpenClaw's internals are NEVER touched. They keep calling loadConfig().
 * DeXMart request handlers that have a userId call loadConfigForUser() instead.
 *
 * Dependency injection pattern: Redis and Firestore clients are passed in as
 * plain structural interfaces (not imported directly) so this module has zero
 * runtime coupling to firebase-admin or ioredis — it is trivially unit-testable.
 */

import type { OpenClawConfig } from "./types.openclaw.js";

// ── Dependency Interfaces (structural — no hard imports required) ─────────────

export interface UserConfigRedis {
  get(key: string): Promise<string | null>;
  setex(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export interface UserConfigFirestore {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
    };
  };
}

/** Injected loadConfig() function — swappable in tests without touching io.ts */
export type BaseConfigLoader = () => OpenClawConfig;

// ── Cache State ───────────────────────────────────────────────────────────────

/** In-process LRU-style map for hot-path config access (<1ms). */
const memCache = new Map<string, { config: OpenClawConfig; expiresAt: number }>();

/** TTL for all cache layers: 5 minutes (per spec NFR-1). */
export const USER_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Resolves an OpenClawConfig scoped to a specific user (the DeXMart "tenant").
 *
 * Resolution order (first hit wins):
 *   1. In-memory cache  — hot path, <1ms
 *   2. Redis cache      — warm path, target <50ms (NFR-1)
 *   3. Firestore        — cold path, target <200ms (NFR-1)
 *   4. Base loadConfig  — fallback when no user config is stored yet
 *
 * User config is merged OVER the base OpenClaw config so all OpenClaw defaults
 * are preserved. Only fields explicitly stored in Firestore override defaults.
 *
 * @param userId      - The authenticated Firebase UID (the isolation key).
 * @param redis       - Redis client for warm-path caching. Pass null to skip.
 * @param firestore   - Firestore client for cold-path lookup. Pass null to skip.
 * @param loadConfig  - Base config loader (defaults to OpenClaw's loadConfig).
 */
export async function loadConfigForUser(
  userId: string,
  redis: UserConfigRedis | null | undefined,
  firestore: UserConfigFirestore | null | undefined,
  loadConfig: BaseConfigLoader,
): Promise<OpenClawConfig> {
  const cacheKey = `user:config:${userId}`;
  const now = Date.now();

  // ── Layer 1: In-memory cache ─────────────────────────────────────────────
  const memHit = memCache.get(cacheKey);
  if (memHit && memHit.expiresAt > now) {
    return memHit.config;
  }

  // ── Layer 2: Redis cache ─────────────────────────────────────────────────
  if (redis) {
    try {
      const raw = await redis.get(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as OpenClawConfig;
        memCache.set(cacheKey, { config: parsed, expiresAt: now + USER_CONFIG_CACHE_TTL_MS });
        return parsed;
      }
    } catch {
      // Redis unavailable — non-fatal, fall through to Firestore (FR-1 resilience rule)
    }
  }

  // ── Layer 3: Firestore ───────────────────────────────────────────────────
  if (firestore) {
    try {
      const doc = await firestore.collection("users").doc(userId).get();
      if (doc.exists) {
        const data = doc.data();
        const userConfigData = data?.["config"];
        if (
          userConfigData &&
          typeof userConfigData === "object" &&
          !Array.isArray(userConfigData)
        ) {
          const base = loadConfig();
          // Shallow merge: user config overrides base defaults; OpenClaw keys are preserved
          const merged = {
            ...base,
            ...(userConfigData as Record<string, unknown>),
          } as OpenClawConfig;
          memCache.set(cacheKey, { config: merged, expiresAt: now + USER_CONFIG_CACHE_TTL_MS });
          // Backfill Redis so next request is warm
          if (redis) {
            try {
              await redis.setex(
                cacheKey,
                Math.floor(USER_CONFIG_CACHE_TTL_MS / 1000),
                JSON.stringify(merged),
              );
            } catch {
              // Non-fatal: Redis write failure does not block config resolution
            }
          }
          return merged;
        }
      }
    } catch {
      // Firestore unavailable — non-fatal, fall through to base config
    }
  }

  // ── Layer 4: Base config fallback ────────────────────────────────────────
  // No user config stored yet (new user) or all deps unavailable.
  return loadConfig();
}

/**
 * Invalidates all cache layers for a user's config.
 *
 * Call this immediately after a user saves config changes from the dashboard
 * so the next request sees fresh data rather than stale cached config.
 *
 * @param userId  - The Firebase UID whose config should be invalidated.
 * @param redis   - Redis client to delete the cached entry. Pass null to skip.
 */
export async function invalidateUserConfigCache(
  userId: string,
  redis: Pick<UserConfigRedis, "del"> | null | undefined,
): Promise<void> {
  const cacheKey = `user:config:${userId}`;
  memCache.delete(cacheKey);
  if (redis) {
    try {
      await redis.del(cacheKey);
    } catch {
      // Non-fatal: stale Redis entry will expire naturally via TTL
    }
  }
}

/**
 * Exposed for testing only — clears the entire in-memory cache.
 * Do NOT call in production code.
 */
export function _clearMemCacheForTests(): void {
  memCache.clear();
}
