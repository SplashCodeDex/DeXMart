import { Redis } from 'ioredis';
import crypto from 'crypto';
import configManager from '../config/ConfigManager.js';
import logger from '../utils/logger.js';
import { socketService } from './socketService.js';
import { firebaseService } from './FirebaseService.js';

/**
 * AntiBanService
 * 
 * Centralized Anti-Ban Engine for DeXMart.
 * Protects the server's public IP from WhatsApp bans by intercepting
 * outbound traffic at the Application Layer.
 * 
 * Two core rules:
 * 1. Velocity Rule  — Redis sliding window rate limiter per tenant.
 * 2. Content Rule   — Message body hash deduplication for campaigns.
 * 
 * Modeled after enterprise ESPs (SendGrid, Mailchimp) that protect
 * shared IP reputation by moderating outbound traffic.
 */
class AntiBanService {
  private static instance: AntiBanService;
  private redis: InstanceType<typeof Redis> | null = null;

  /** Default velocity: max 1 message per this many seconds */
  private readonly DEFAULT_MIN_DELAY_SEC = 5;
  private readonly DEFAULT_MAX_DELAY_SEC = 7;

  /** Content Rule: max identical messages before triggering cooldown */
  private readonly DEFAULT_CONTENT_THRESHOLD = 100;

  /** Cooldown duration in seconds (default 5 minutes) */
  private readonly DEFAULT_COOLDOWN_SEC = 300;

  private constructor() {
    try {
      this.redis = new Redis({
        host: configManager.config.redis.host,
        port: configManager.config.redis.port,
        password: configManager.config.redis.password,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('error', (err: Error) => {
        logger.warn('[AntiBanService] Redis connection error (Anti-Ban features degraded):', err.message);
      });

      this.redis.connect().catch(() => {
        logger.warn('[AntiBanService] Could not connect to Redis. Anti-Ban features will be disabled.');
        this.redis = null;
      });
    } catch {
      logger.warn('[AntiBanService] Redis unavailable. Anti-Ban features disabled.');
      this.redis = null;
    }
  }

  public static getInstance(): AntiBanService {
    if (!AntiBanService.instance) {
      AntiBanService.instance = new AntiBanService();
    }
    return AntiBanService.instance;
  }

  /**
   * Internal Lua script to book a velocity slot atomically.
   * Ensures that even under high concurrency, messages are strictly
   * serialized per number with NO overlaps.
   */
  private readonly RESERVE_SLOT_SCRIPT = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local delay = tonumber(ARGV[2])

    local next_slot = redis.call('GET', key)
    if not next_slot then
        next_slot = 0
    else
        next_slot = tonumber(next_slot)
    end

    local wait_ms = 0
    local new_slot = 0

    if next_slot < now then
        new_slot = now + delay
        wait_ms = 0
    else
        new_slot = next_slot + delay
        wait_ms = next_slot - now
    end

    redis.call('SET', key, new_slot, 'EX', 600)
    return tostring(wait_ms)
  `;

  // ─────────────────────────────────────────────────────────
  // 1. VELOCITY RULE — Atomic Slot Booking
  // ─────────────────────────────────────────────────────────

  /**
   * Reserva a velocity slot for a specific WhatsApp channel.
   * Returns the number of milliseconds the worker MUST wait before sending.
   * 
   * This is ATOMIC. Even if 100 workers call this at once, they will
   * each get a unique, non-overlapping time slot.
   * 
   * @param channelId The unique ID of the WhatsApp number (channel)
   * @returns Wait time in milliseconds.
   */
  public async reserveVelocityDelay(channelId: string): Promise<number> {
    if (!this.redis) return 0;

    const key = `antiban:velocity:slot:${channelId}`;
    const now = Date.now();
    const delay = Math.floor(this.randomDelay() * 1000);

    try {
      // Define the script if not already loaded (ioredis handles caching)
      const waitMsStr = await this.redis.eval(
        this.RESERVE_SLOT_SCRIPT,
        1,
        key,
        now.toString(),
        delay.toString()
      ) as string;

      return parseInt(waitMsStr, 10);
    } catch (err) {
      logger.warn('[AntiBanService] Velocity reservation failed, falling back to instant send:', err);
      return 0;
    }
  }

  /**
   * @deprecated Slot is now reserved upfront in reserveVelocityDelay
   */
  public async recordMessageSent(_channelId: string): Promise<void> {
    // No-op - slot is pre-booked
  }

  /**
   * Returns a randomized delay between MIN and MAX seconds.
   */
  private randomDelay(): number {
    return this.DEFAULT_MIN_DELAY_SEC +
      Math.random() * (this.DEFAULT_MAX_DELAY_SEC - this.DEFAULT_MIN_DELAY_SEC);
  }

  // ─────────────────────────────────────────────────────────
  // 2. CONTENT RULE — Message Hash Deduplication
  // ─────────────────────────────────────────────────────────

  /**
   * Checks if a campaign is sending too many identical messages.
   * 
   * Hashes the message body and increments a Redis counter.
   * If the counter exceeds the threshold, returns true (should pause).
   * 
   * @param tenantId    The tenant sending the campaign
   * @param campaignId  The campaign ID
   * @param messageBody The rendered message text (after variable substitution)
   * @returns true if the content threshold is exceeded (should pause)
   */
  public async checkContentHash(tenantId: string, campaignId: string, messageBody: string): Promise<boolean> {
    if (!this.redis) return false; // Graceful degradation

    const hash = crypto.createHash('md5').update(messageBody.trim().toLowerCase()).digest('hex');
    const key = `antiban:content:${tenantId}:${campaignId}:${hash}`;

    try {
      const count = await this.redis.incr(key);

      // Set expiry on first increment so keys auto-cleanup
      if (count === 1) {
        await this.redis.expire(key, 3600); // 1 hour window
      }

      if (count >= this.DEFAULT_CONTENT_THRESHOLD) {
        logger.warn(
          `[AntiBanService] Content Rule triggered for tenant ${tenantId}, campaign ${campaignId}. ` +
          `${count} identical messages detected (hash: ${hash.substring(0, 8)}...).`
        );
        return true;
      }

      return false;
    } catch (err) {
      logger.warn('[AntiBanService] Content hash check failed, allowing message:', err);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. COOLDOWN & ALERT SYSTEM
  // ─────────────────────────────────────────────────────────

  /**
   * Triggers a cooldown on a campaign.
   * - Pauses the campaign in Firebase.
   * - Emits a real-time socket alert to the tenant's dashboard.
   * - Stores cooldown metadata in Redis for the "Resume" timer.
   * 
   * @param tenantId    The tenant owning the campaign
   * @param campaignId  The campaign to pause
   * @param reason      Human-readable reason for the pause
   * @param autoResume  Whether to automatically resume after cooldown (Premium feature)
   */
  public async triggerCooldown(
    tenantId: string,
    campaignId: string,
    reason: string,
    autoResume: boolean = false
  ): Promise<void> {
    const cooldownSeconds = this.DEFAULT_COOLDOWN_SEC;

    // 1. Pause the campaign in Firebase
    try {
      await firebaseService.setDoc<'tenants/{tenantId}/campaigns'>(
        'campaigns',
        campaignId,
        {
          status: 'paused',
          updatedAt: new Date(),
        },
        tenantId,
        true // merge
      );
      logger.info(`[AntiBanService] Campaign ${campaignId} paused (reason: ${reason})`);
    } catch (err) {
      logger.error(`[AntiBanService] Failed to pause campaign ${campaignId}:`, err);
    }

    // 2. Store cooldown timer in Redis
    if (this.redis) {
      const cooldownKey = `antiban:cooldown:${tenantId}:${campaignId}`;
      try {
        await this.redis.set(cooldownKey, JSON.stringify({
          reason,
          pausedAt: Date.now(),
          cooldownSeconds,
          expiresAt: Date.now() + (cooldownSeconds * 1000),
          autoResume,
          tenantId,
        }), 'EX', cooldownSeconds + 60); // Extra 60s buffer
      } catch (err) {
        logger.warn('[AntiBanService] Failed to store cooldown metadata:', err);
      }
    }

    // 3. Emit real-time alert to the tenant's dashboard
    socketService.emitToTenant(tenantId, 'antiban_alert', {
      campaignId,
      action: 'paused',
      reason,
      cooldownSeconds,
      message: `⚠️ Campaign paused to protect your WhatsApp number from being banned. ` +
        `Reason: ${reason}. ` +
        `Pausing helps WhatsApp see your traffic as normal human activity. ` +
        `You can resume in ${Math.ceil(cooldownSeconds / 60)} minutes.`,
    });
  }

  /**
   * Non-blocking helper to find keys matching a pattern.
   * Replaces the blocking O(N) KEYS command.
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    if (!this.redis) return [];
    
    let cursor = '0';
    const foundKeys: string[] = [];
    
    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        foundKeys.push(...keys);
      } while (cursor !== '0');
      
      return foundKeys;
    } catch (err) {
      logger.error('[AntiBanService] Redis SCAN failed:', err);
      return [];
    }
  }

  /**
   * Scans for cooldowns that have reached their expiration time.
   * Internal utility for the background resume worker.
   */
  public async getExpiredCooldowns(): Promise<any[]> {
    if (!this.redis) return [];
    
    const expired: any[] = [];
    try {
      const keys = await this.scanKeys('antiban:cooldown:*');

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (!data) continue;

        const metadata = JSON.parse(data);
        if (metadata.expiresAt <= Date.now()) {
          expired.push({ ...metadata, redisKey: key });
        }
      }
      return expired;
    } catch (err) {
      logger.error('[AntiBanService] Error scanning for expired cooldowns:', err);
      return [];
    }
  }

  /**
   * Explicitly remove a cooldown key from Redis.
   */
  public async removeCooldown(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
    }
  }

  /**
   * Checks if a campaign is currently in cooldown.
   * Returns the remaining cooldown time in seconds, or 0 if clear.
   */
  public async getCooldownRemaining(tenantId: string, campaignId: string): Promise<number> {
    if (!this.redis) return 0;

    const cooldownKey = `antiban:cooldown:${tenantId}:${campaignId}`;
    try {
      const data = await this.redis.get(cooldownKey);
      if (!data) return 0;

      const { expiresAt } = JSON.parse(data);
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      return remaining;
    } catch {
      return 0;
    }
  }

  /**
   * Cleans up Redis keys for a completed/deleted campaign.
   */
  public async cleanupCampaign(tenantId: string, campaignId: string): Promise<void> {
    if (!this.redis) return;

    try {
      const keys = await this.scanKeys(`antiban:content:${tenantId}:${campaignId}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      const cooldownKey = `antiban:cooldown:${tenantId}:${campaignId}`;
      await this.redis.del(cooldownKey);
    } catch (err) {
      logger.warn('[AntiBanService] Cleanup failed:', err);
    }
  }

  /**
   * Gracefully close the Redis connection.
   */
  public async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export const antiBanService = AntiBanService.getInstance();
