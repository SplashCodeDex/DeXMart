/**
 * Universal ApiKeyManager v2.0
 * Implements: Rotation, Circuit Breaker, Persistence, Exponential Backoff
 * Gemini-Specific: finishReason handling, Safety blocks, RECITATION detection
 */

export interface KeyState {
  key: string;
  failCount: number; // Consecutive failures
  failedAt: number | null; // Timestamp of last failure
  isQuotaError: boolean; // Was last error a 429?
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN" | "DEAD";
  lastUsed: number;
  successCount: number;
  totalRequests: number;
  halfOpenTestTime: number | null;
  customCooldown: number | null; // From Retry-After header
}

export type ErrorType =
  | "QUOTA" // 429 - Rotate key, respect cooldown
  | "TRANSIENT" // 500/503/504 - Retry with backoff
  | "AUTH" // 403 - Key is dead, remove from pool
  | "BAD_REQUEST" // 400 - Do not retry, fix request
  | "SAFETY" // finishReason: SAFETY - Not a key issue
  | "RECITATION" // finishReason: RECITATION - Not a key issue
  | "UNKNOWN"; // Catch-all

export interface ErrorClassification {
  type: ErrorType;
  retryable: boolean;
  cooldownMs: number;
  markKeyFailed: boolean;
  markKeyDead: boolean;
}

const CONFIG = {
  MAX_CONSECUTIVE_FAILURES: 5,
  COOLDOWN_TRANSIENT: 60 * 1000, // 1 minute
  COOLDOWN_QUOTA: 5 * 60 * 1000, // 5 minutes (default if no Retry-After)
  COOLDOWN_QUOTA_DAILY: 60 * 60 * 1000, // 1 hour for RPD exhaustion
  HALF_OPEN_TEST_DELAY: 60 * 1000, // 1 minute after open
  MAX_BACKOFF: 64 * 1000, // 64 seconds max
  BASE_BACKOFF: 1000, // 1 second base
};

// Error classification patterns
const ERROR_PATTERNS = {
  isQuotaError: /429|quota|exhausted|resource.?exhausted|too.?many.?requests|rate.?limit/i,
  isAuthError: /403|permission.?denied|invalid.?api.?key|unauthorized|unauthenticated/i,
  isSafetyBlock: /safety|blocked|recitation|harmful/i,
  isTransient: /500|502|503|504|internal|unavailable|deadline|timeout|overloaded/i,
  isBadRequest: /400|invalid.?argument|failed.?precondition|malformed|not.?found|404/i,
};

export class ApiKeyManager {
  private keys: KeyState[] = [];
  private storageKey = "api_rotation_state_v2";
  // Simplified Storage interface for Node.js environment
  private storage: any;

  constructor(initialKeys: string[], storage?: any) {
    // Simple in-memory storage mock if none provided (for testing/Node)
    this.storage = storage || {
      getItem: () => null,
      setItem: () => {},
    };

    // 1. Sanitize & Deduplicate Keys "Even Better"
    const uniqueKeys = new Set<string>();
    initialKeys.forEach((rawKey) => {
      // Handle comma-separated keys if they appear in a single string
      const parts = rawKey
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      parts.forEach((p) => uniqueKeys.add(p));
    });

    // 2. Warn about duplicates/empty
    const sanitizedCount = uniqueKeys.size;
    const rawLength = initialKeys.length; // Might be misleading if split happened, but roughly
    if (sanitizedCount < rawLength) {
      console.warn(
        `[ApiKeyManager] Optimized key pool: Removed ${rawLength - sanitizedCount} duplicate/empty keys.`,
      );
    }

    this.keys = Array.from(uniqueKeys).map((k) => ({
      key: k,
      failCount: 0,
      failedAt: null,
      isQuotaError: false,
      circuitState: "CLOSED",
      lastUsed: 0,
      successCount: 0,
      totalRequests: 0,
      halfOpenTestTime: null,
      customCooldown: null,
    }));

    this.loadState();
  }

  /**
   * CLASSIFIES an error to determine handling strategy
   */
  public classifyError(error: any, finishReason?: string): ErrorClassification {
    const status = error?.status || error?.response?.status;
    const message = error?.message || error?.error?.message || String(error);

    // 1. Check finishReason first (for 200 responses with content issues)
    if (finishReason === "SAFETY") {
      return {
        type: "SAFETY",
        retryable: false,
        cooldownMs: 0,
        markKeyFailed: false,
        markKeyDead: false,
      };
    }
    if (finishReason === "RECITATION") {
      return {
        type: "RECITATION",
        retryable: false,
        cooldownMs: 0,
        markKeyFailed: false,
        markKeyDead: false,
      };
    }

    // 2. Check HTTP status codes
    if (status === 403 || ERROR_PATTERNS.isAuthError.test(message)) {
      return {
        type: "AUTH",
        retryable: false,
        cooldownMs: Infinity,
        markKeyFailed: true,
        markKeyDead: true,
      };
    }
    if (status === 429 || ERROR_PATTERNS.isQuotaError.test(message)) {
      const retryAfter = this.parseRetryAfter(error);
      return {
        type: "QUOTA",
        retryable: true,
        cooldownMs: retryAfter || CONFIG.COOLDOWN_QUOTA,
        markKeyFailed: true,
        markKeyDead: false,
      };
    }
    if (status === 400 || ERROR_PATTERNS.isBadRequest.test(message)) {
      return {
        type: "BAD_REQUEST",
        retryable: false,
        cooldownMs: 0,
        markKeyFailed: false,
        markKeyDead: false,
      };
    }
    if (ERROR_PATTERNS.isTransient.test(message) || [500, 502, 503, 504].includes(status)) {
      return {
        type: "TRANSIENT",
        retryable: true,
        cooldownMs: CONFIG.COOLDOWN_TRANSIENT,
        markKeyFailed: true,
        markKeyDead: false,
      };
    }

    return {
      type: "UNKNOWN",
      retryable: true,
      cooldownMs: CONFIG.COOLDOWN_TRANSIENT,
      markKeyFailed: true,
      markKeyDead: false,
    };
  }

  /**
   * Parses Retry-After header from error response
   */
  private parseRetryAfter(error: any): number | null {
    const retryAfter =
      error?.response?.headers?.["retry-after"] ||
      error?.headers?.["retry-after"] ||
      error?.retryAfter;

    if (!retryAfter) return null;

    // If it's a number (seconds)
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds * 1000;

    // If it's a date string
    const date = Date.parse(retryAfter);
    if (!isNaN(date)) return Math.max(0, date - Date.now());

    return null;
  }

  /**
   * HEALTH CHECK
   * Determines if a key is usable based on Circuit Breaker logic
   */
  private isOnCooldown(k: KeyState): boolean {
    // Dead keys are NEVER usable
    if (k.circuitState === "DEAD") return true;

    const now = Date.now();

    if (k.circuitState === "OPEN") {
      // Check if ready for HALF_OPEN test
      if (k.halfOpenTestTime && now >= k.halfOpenTestTime) {
        k.circuitState = "HALF_OPEN";
        return false;
      }
      return true;
    }

    // Additional safeguard for custom cooldowns
    if (k.failedAt && k.customCooldown) {
      if (now - k.failedAt < k.customCooldown) return true;
    }

    // Standard cooldown check
    if (k.failedAt) {
      const cooldown = k.isQuotaError ? CONFIG.COOLDOWN_QUOTA : CONFIG.COOLDOWN_TRANSIENT;
      if (now - k.failedAt < cooldown) return true;
    }

    return false;
  }

  /**
   * CORE ROTATION LOGIC
   * Returns the best available key
   */
  public getKey(): string | null {
    // 1. Filter out dead and cooling down keys
    const candidates = this.keys.filter((k) => k.circuitState !== "DEAD" && !this.isOnCooldown(k));

    if (candidates.length === 0) {
      // FALLBACK: Return oldest failed key (excluding DEAD)
      const nonDead = this.keys.filter((k) => k.circuitState !== "DEAD");
      if (nonDead.length === 0) return null; // All keys are dead!

      return nonDead.sort((a, b) => (a.failedAt || 0) - (b.failedAt || 0))[0]?.key || null;
    }

    // 2. Sort candidates: Pristine > Fewest Failures > Least Recently Used
    candidates.sort((a, b) => {
      if (a.failCount !== b.failCount) return a.failCount - b.failCount;
      return a.lastUsed - b.lastUsed;
    });

    const selected = candidates[0];
    selected.lastUsed = Date.now();
    this.saveState();

    return selected.key;
  }

  /**
   * Get count of healthy (non-DEAD) keys
   */
  public getKeyCount(): number {
    return this.keys.filter((k) => k.circuitState !== "DEAD").length;
  }

  /**
   * FEEDBACK LOOP: Success
   */
  public markSuccess(key: string) {
    const k = this.keys.find((x) => x.key === key);
    if (!k) return;

    if (k.circuitState !== "CLOSED" && k.circuitState !== "DEAD") {
      console.log(`[Key Recovered] ...${key.slice(-4)}`);
    }

    k.circuitState = "CLOSED";
    k.failCount = 0;
    k.failedAt = null;
    k.isQuotaError = false;
    k.customCooldown = null;
    k.successCount++;
    k.totalRequests++;

    this.saveState();
  }

  /**
   * FEEDBACK LOOP: Failure
   * Enhanced with error classification
   */
  public markFailed(key: string, classification: ErrorClassification) {
    const k = this.keys.find((x) => x.key === key);
    if (!k) return;

    // Don't modify DEAD keys
    if (k.circuitState === "DEAD") return;

    // If this error shouldn't mark the key as failed, skip
    if (!classification.markKeyFailed) return;

    k.failedAt = Date.now();
    k.failCount++;
    k.totalRequests++;
    k.isQuotaError = classification.type === "QUOTA";
    k.customCooldown = classification.cooldownMs || null;

    // Permanent death for auth errors
    if (classification.markKeyDead) {
      k.circuitState = "DEAD";
      console.error(`[Key DEAD] ...${key.slice(-4)} - Permanently removed from rotation`);
      this.saveState();
      return;
    }

    // State Transitions
    if (k.circuitState === "HALF_OPEN") {
      k.circuitState = "OPEN";
      k.halfOpenTestTime = Date.now() + CONFIG.HALF_OPEN_TEST_DELAY;
    } else if (k.failCount >= CONFIG.MAX_CONSECUTIVE_FAILURES || classification.type === "QUOTA") {
      k.circuitState = "OPEN";
      k.halfOpenTestTime = Date.now() + (classification.cooldownMs || CONFIG.HALF_OPEN_TEST_DELAY);
    }

    this.saveState();
  }

  /**
   * Legacy markFailed for backward compatibility
   */
  public markFailedLegacy(key: string, isQuota: boolean = false) {
    this.markFailed(key, {
      type: isQuota ? "QUOTA" : "TRANSIENT",
      retryable: true,
      cooldownMs: isQuota ? CONFIG.COOLDOWN_QUOTA : CONFIG.COOLDOWN_TRANSIENT,
      markKeyFailed: true,
      markKeyDead: false,
    });
  }

  /**
   * Calculate backoff delay with jitter
   */
  public calculateBackoff(attempt: number): number {
    const exponential = CONFIG.BASE_BACKOFF * Math.pow(2, attempt);
    const capped = Math.min(exponential, CONFIG.MAX_BACKOFF);
    const jitter = Math.random() * 1000;
    return capped + jitter;
  }

  /**
   * Get health statistics
   */
  public getStats(): { total: number; healthy: number; cooling: number; dead: number } {
    const total = this.keys.length;
    const dead = this.keys.filter((k) => k.circuitState === "DEAD").length;
    const cooling = this.keys.filter(
      (k) => k.circuitState === "OPEN" || k.circuitState === "HALF_OPEN",
    ).length;
    const healthy = total - dead - cooling;
    return { total, healthy, cooling, dead };
  }

  // Helper for testing
  public _getKeys(): KeyState[] {
    return this.keys;
  }

  private saveState() {
    if (!this.storage) return;
    const state = this.keys.reduce(
      (acc, k) => ({
        ...acc,
        [k.key]: {
          failCount: k.failCount,
          failedAt: k.failedAt,
          isQuotaError: k.isQuotaError,
          circuitState: k.circuitState,
          lastUsed: k.lastUsed,
          successCount: k.successCount,
          totalRequests: k.totalRequests,
          customCooldown: k.customCooldown,
        },
      }),
      {},
    );
    this.storage.setItem(this.storageKey, JSON.stringify(state));
  }

  private loadState() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.keys.forEach((k) => {
        if (data[k.key]) Object.assign(k, data[k.key]);
      });
    } catch (e) {
      console.error("Failed to load key state");
    }
  }
}
