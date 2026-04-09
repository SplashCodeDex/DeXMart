/**
 * ChannelManager.ts — DeXMart Fusion: Multi-Tenant Adapter Registry
 *
 * This is the DeXMart adapter instance registry. It manages RUNNING adapter
 * instances per user×channel combination. It is complementary to — not a
 * replacement for — OpenClaw's createChannelManager() (src/gateway/server-channels.ts),
 * which manages channel plugin lifecycle at the OpenClaw engine level.
 *
 * Relationship:
 *   OpenClaw createChannelManager() → manages channel plugin start/stop lifecycle
 *   DeXMart ChannelManager (this)   → manages live adapter instances per user×channel
 *
 * The key (instanceId) is a unique string per user×channel, e.g.:
 *   `${userId}:${channelId}` or just `${channelId}` for single-tenant CLI use.
 *
 * B2C model: user = tenant, userId scopes every adapter instance.
 */

import logger from '../../utils/logger.js';

// ── Adapter Interface ─────────────────────────────────────────────────────────

/**
 * Minimal interface every channel adapter must satisfy to be registered.
 * Matches the contract used by WhatsappAdapter and all other channel adapters.
 */
export interface ChannelAdapter {
  /** Unique key for this adapter instance (e.g., `${userId}:${channelId}`) */
  instanceId: string;
  /** The channel type (e.g., 'whatsapp', 'telegram') */
  id?: string;
  /** Connection or readiness status for tracking */
  status?: string;
  /** Gracefully shut down the adapter and release resources */
  shutdown(): Promise<void>;
  /** Send a message natively through the adapter */
  sendMessage?(to: string, content: any): Promise<any>;
  /** Handle dynamic inbound webhook data */
  handleWebhook?(req: any, res: any): Promise<any>;
  /** Update connection paths or auth paths */
  updatePath?(metadata: any): Promise<any>;
}

// ── ChannelManager Singleton ──────────────────────────────────────────────────

/**
 * Registry of live channel adapter instances.
 *
 * This is a singleton — one registry per process, shared across all request
 * handlers. Each adapter is keyed by its instanceId (unique per user×channel).
 */
export class ChannelManager {
  private static instance: ChannelManager;
  private adapters = new Map<string, ChannelAdapter>();

  private constructor() {}

  public static getInstance(): ChannelManager {
    if (!ChannelManager.instance) {
      ChannelManager.instance = new ChannelManager();
    }
    return ChannelManager.instance;
  }

  /**
   * Register a new channel adapter instance.
   * If an adapter is already registered for the same key, it is shut down first
   * to prevent resource leaks (stale socket connections, auth state, timers).
   *
   * @param adapter - The adapter to register. Must have a unique instanceId.
   */
  public registerAdapter(adapter: ChannelAdapter): void {
    const key = adapter.instanceId || adapter.id;
    if (!key) {
      logger.error('[ChannelManager] Cannot register adapter without instanceId or id');
      return;
    }
    if (this.adapters.has(key)) {
      const stale = this.adapters.get(key)!;
      logger.warn(`[ChannelManager] Shutting down stale adapter before overwrite for key: ${key}`);
      stale.shutdown().catch((e: Error) =>
        logger.error(`[ChannelManager] Stale adapter shutdown error for ${key}:`, e),
      );
    }
    this.adapters.set(key, adapter);
    logger.info(`[ChannelManager] Registered adapter for key: ${key}`);
  }

  /**
   * Get a registered adapter by its instance key.
   *
   * @param key - The instanceId used when the adapter was registered.
   * @returns The adapter, or undefined if not registered.
   */
  public getAdapter(key: string): ChannelAdapter | undefined {
    return this.adapters.get(key);
  }

  /**
   * Send a message through a registered adapter.
   * Throws if no adapter is found for the given key.
   *
   * @param key     - The adapter's instanceId.
   * @param to      - Recipient identifier (JID, chat ID, etc.).
   * @param content - Message content (string or structured object).
   */
  public async sendMessage(key: string, to: string, content: unknown): Promise<void> {
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new Error(`[ChannelManager] No adapter registered for key: ${key}`);
    }
    // Adapter must implement sendMessage — cast to any since not all adapters expose it
    await (adapter as any).sendMessage(to, content);
  }

  /**
   * Gracefully shut down and unregister an adapter.
   * Safe to call even if the key is not registered (no-op).
   *
   * @param key - The adapter's instanceId.
   */
  public async shutdownAdapter(key: string): Promise<void> {
    const adapter = this.adapters.get(key);
    if (adapter) {
      logger.info(`[ChannelManager] Shutting down adapter: ${key}`);
      await adapter.shutdown();
      this.adapters.delete(key);
    }
  }

  /**
   * Returns all currently registered adapter keys.
   * Used by health monitors and dashboard status endpoints.
   */
  public getRegisteredChannelKeys(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Returns the total number of registered adapters.
   * Used by AuthGuard to enforce per-user channel limits.
   */
  public getAdapterCount(): number {
    return this.adapters.size;
  }

  /**
   * Returns all adapters for a specific user (by userId prefix in instanceId).
   * Convention: instanceId = `${userId}:${channelId}` for multi-user deployments.
   *
   * @param userId - Firebase UID of the user.
   */
  public getAdaptersForUser(userId: string): ChannelAdapter[] {
    const prefix = `${userId}:`;
    return [...this.adapters.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, adapter]) => adapter);
  }

  /**
   * Shut down ALL adapters for a specific user.
   * Call on user account deletion or plan suspension.
   *
   * @param userId - Firebase UID of the user.
   */
  public async shutdownUserAdapters(userId: string): Promise<void> {
    const prefix = `${userId}:`;
    const userKeys = [...this.adapters.keys()].filter((k) => k.startsWith(prefix));
    await Promise.allSettled(userKeys.map((key) => this.shutdownAdapter(key)));
    logger.info(`[ChannelManager] Shut down ${userKeys.length} adapter(s) for user: ${userId}`);
  }
}

/** Module-level singleton export — matches the original compiled interface */
export const channelManager = ChannelManager.getInstance();
