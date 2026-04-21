/**
 * Tests for loadConfigForUser and invalidateUserConfigCache (FR-1 spec).
 *
 * Strategy:
 *   - Mock all external I/O (Redis, Firestore, base loadConfig).
 *   - Test the three-layer resolution: mem-cache → Redis → Firestore → fallback.
 *   - Verify cache invalidation clears both layers.
 *   - Never mock internal logic (per project testing rules).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadConfigForUser,
  invalidateUserConfigCache,
  _clearMemCacheForTests,
} from "./user-config.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRedis(overrides: Partial<{ get: any; setex: any; del: any }> = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function makeFirestore(configData?: Record<string, unknown>) {
  const exists = configData !== undefined;
  return {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists,
          data: () => (exists ? { config: configData } : undefined),
        }),
      }),
    }),
  };
}

/** Stub base config loader — no filesystem, no json5, no tslog */
const baseLoader = vi.fn(() => ({ ui: { seamColor: "base-color" }, providers: [] }) as any);

// ── Tests ────────────────────────────────────────────────────────────────────
describe("loadConfigForUser", () => {
  beforeEach(() => {
    _clearMemCacheForTests();
    baseLoader.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns Redis-cached config without hitting Firestore (warm path)", async () => {
    const cachedConfig = { ui: { seamColor: "cached-color" }, providers: [] };
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(JSON.stringify(cachedConfig)) });
    const firestore = makeFirestore({ ui: { seamColor: "firestore-color" } });

    const result = await loadConfigForUser("user-a", redis, firestore, baseLoader);

    expect(result.ui?.seamColor).toBe("cached-color");
    expect(redis.get).toHaveBeenCalledWith("user:config:user-a");
    // Firestore must NOT be called on a Redis cache hit
    expect(firestore.collection).not.toHaveBeenCalled();
    // Base loader must NOT be called on a cache hit
    expect(baseLoader).not.toHaveBeenCalled();
  });

  it("reads from Firestore on Redis miss and populates Redis (cold path)", async () => {
    const redis = makeRedis();
    const firestore = makeFirestore({ ui: { seamColor: "firestore-color" } });

    const result = await loadConfigForUser("user-b", redis, firestore, baseLoader);

    expect(result.ui?.seamColor).toBe("firestore-color");
    expect(redis.get).toHaveBeenCalledWith("user:config:user-b");
    expect(firestore.collection).toHaveBeenCalledWith("users");
    // Redis should be populated after Firestore read
    expect(redis.setex).toHaveBeenCalledWith(
      "user:config:user-b",
      300, // 5-minute TTL in seconds
      expect.any(String),
    );
  });

  it("falls back to base loadConfig when no user config exists in Firestore", async () => {
    const redis = makeRedis();
    const firestore = makeFirestore(undefined); // no config stored for this user yet

    const result = await loadConfigForUser("user-missing", redis, firestore, baseLoader);

    expect(result.ui?.seamColor).toBe("base-color");
    expect(baseLoader).toHaveBeenCalledOnce();
    // Redis should NOT be populated on fallback (nothing user-specific to cache)
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it("falls back to Firestore when Redis is unavailable (non-fatal)", async () => {
    const brokenRedis = makeRedis({
      get: vi.fn().mockRejectedValue(new Error("Redis connection refused")),
    });
    const firestore = makeFirestore({ ui: { seamColor: "firestore-color" } });

    // Should not throw — Redis failure is non-fatal per FR-1 resilience rule
    const result = await loadConfigForUser("user-a", brokenRedis, firestore, baseLoader);

    expect(result.ui?.seamColor).toBe("firestore-color");
  });

  it("falls back to base loadConfig when no deps are provided", async () => {
    const result = await loadConfigForUser("user-a", null, null, baseLoader);

    expect(result.ui?.seamColor).toBe("base-color");
    expect(baseLoader).toHaveBeenCalledOnce();
  });

  it("returns in-memory cached result on second call without hitting Redis or Firestore", async () => {
    const redis = makeRedis();
    const firestore = makeFirestore({ ui: { seamColor: "firestore-color" } });

    // First call — hits Firestore, populates mem-cache
    await loadConfigForUser("user-a", redis, firestore, baseLoader);
    redis.get.mockClear();
    firestore.collection.mockClear();

    // Second call — should hit in-memory cache only
    const result = await loadConfigForUser("user-a", redis, firestore, baseLoader);

    expect(result.ui?.seamColor).toBe("firestore-color");
    expect(redis.get).not.toHaveBeenCalled();
    expect(firestore.collection).not.toHaveBeenCalled();
  });
});

describe("invalidateUserConfigCache", () => {
  beforeEach(() => {
    _clearMemCacheForTests();
  });

  it("removes entry from in-memory cache and calls redis.del", async () => {
    const redis = makeRedis();
    // Prime the in-memory cache
    const firestore = makeFirestore({ ui: { seamColor: "to-invalidate" } });
    await loadConfigForUser("user-a", redis, firestore, baseLoader);

    // Now invalidate
    await invalidateUserConfigCache("user-a", redis);

    expect(redis.del).toHaveBeenCalledWith("user:config:user-a");

    // After invalidation, next load should hit Firestore again (mem-cache cleared)
    const firestore2 = makeFirestore({ ui: { seamColor: "fresh-color" } });
    // Reset Redis get so next call goes to Firestore
    redis.get.mockResolvedValue(null);
    const result = await loadConfigForUser("user-a", redis, firestore2, baseLoader);
    expect(result.ui?.seamColor).toBe("fresh-color");
  });

  it("handles Redis del failure gracefully (non-fatal)", async () => {
    const redis = makeRedis({ del: vi.fn().mockRejectedValue(new Error("Redis down")) });

    // Should not throw
    await expect(invalidateUserConfigCache("user-a", redis)).resolves.toBeUndefined();
  });
});
