import { firebaseService } from '@/persistence/firebase.js';
import { Channel, ChannelSchema, Result } from '../types/contracts.js';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import logger from '@/utils/logger.js';
import crypto from 'crypto';
import { getSupportedPlatforms, type PlatformMetadata } from './channels/platform-metadata.js';
import { userContextResolver } from '../tenancy/resolver-instance.js';
import { createAuthGuard } from '../tenancy/tenant-context.js';
import { assertCan } from '../billing/auth-guard.js';
import { trackUsage } from '../billing/usage-tracker.js';
import { createChannelManager, type ChannelManager } from '../gateway/server-channels.js';
import { listChannelPlugins, type ChannelId } from '../channels/plugins/index.js';
import { createSubsystemLogger, runtimeForLogger } from '../logging/subsystem.js';
import { loadConfig } from '../config/config.js';

/**
 * Channel Service
 *
 * Manages the lifecycle of connectivity slots.
 * Operates within the Agent hierarchy: tenants/T/agents/A/channels/C.
 */
export class ChannelService {
  private static instance: ChannelService;
  private startingChannels: Map<string, Promise<Result<void>>> = new Map();
  /** Per-tenant native channel managers (B2C SaaS mode). */
  private nativeManagers: Map<string, ChannelManager> = new Map();
  /** Shared manager for aggregate stats and CLI/single-user mode. */
  private sharedNativeManager: ChannelManager | null = null;

  private constructor() { }

  /** Build the log/runtime options required by createChannelManager(). */
  private buildManagerOptions() {
    const plugins = listChannelPlugins();
    const log = createSubsystemLogger('channels');
    const channelLogs = Object.fromEntries(
      plugins.map((p) => [p.id, createSubsystemLogger(`channels/${p.id}`)]),
    ) as Record<ChannelId, ReturnType<typeof createSubsystemLogger>>;
    const channelRuntimeEnvs = Object.fromEntries(
      Object.entries(channelLogs).map(([id, l]) => [id, runtimeForLogger(l)]),
    ) as Record<ChannelId, ReturnType<typeof runtimeForLogger>>;
    void log; // used for context naming only
    return { channelLogs, channelRuntimeEnvs };
  }

  /** Get or create a native ChannelManager scoped to a specific userId. */
  private getNativeManager(userId: string): ChannelManager {
    const existing = this.nativeManagers.get(userId);
    if (existing) return existing;
    const { channelLogs, channelRuntimeEnvs } = this.buildManagerOptions();
    const manager = createChannelManager({ loadConfig, channelLogs, channelRuntimeEnvs });
    this.nativeManagers.set(userId, manager);
    return manager;
  }

  /** Get or create the shared (non-tenant-scoped) native ChannelManager for stats/CLI. */
  private getSharedNativeManager(): ChannelManager {
    if (this.sharedNativeManager) return this.sharedNativeManager;
    const { channelLogs, channelRuntimeEnvs } = this.buildManagerOptions();
    this.sharedNativeManager = createChannelManager({ loadConfig, channelLogs, channelRuntimeEnvs });
    return this.sharedNativeManager;
  }

  public static getInstance(): ChannelService {
    if (!ChannelService.instance) {
      ChannelService.instance = new ChannelService();
    }
    return ChannelService.instance;
  }

  /**
   * Helper to build the nested collection path
   */
  private getPath(agentId: string = 'system_default'): string {
    return `agents/${agentId}/channels`;
  }

  /**
   * Create a new channel slot
   */
  async createChannel(tenantId: string, channelData: Partial<Channel>, agentId: string = 'system_default', userId?: string): Promise<Result<Channel>> {
    try {
      // 1. Check authority for channel creation
      const ctx = await userContextResolver.fromUserId(userId ?? tenantId);
      const guard = createAuthGuard(ctx);
      
      try {
        assertCan(guard.canStartChannel(), 'channel', ctx);
      } catch (err: any) {
        throw new Error(err.message || 'Channel slot limit reached for your current plan.');
      }

      const channelId = `chan_${crypto.randomUUID()}`;
      const { createdAt, updatedAt, config = {}, ...restData } = channelData;

      // Auto-generate a generic webhookSecret for non-native channels
      const isNative = ['whatsapp', 'telegram', 'discord'].includes(restData.type || 'whatsapp');
      if (!isNative && !config.webhookSecret) {
        config.webhookSecret = crypto.randomBytes(32).toString('hex');
      }

      const rawData = {
        id: channelId,
        name: restData.name || 'New Channel',
        status: 'disconnected' as const,
        type: restData.type || 'whatsapp',
        assignedAgentId: agentId,
        stats: {
          messagesSent: 0,
          messagesReceived: 0,
          contactsCount: 0,
          errorsCount: 0
        },
        config,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...restData
      };

      const data = ChannelSchema.parse(rawData);
      await firebaseService.setDoc(this.getPath(agentId), channelId, data as any, tenantId);

      // 2. Record usage
      trackUsage(userId ?? tenantId, 'channels', 1);

      logger.info(`Channel created: ${channelId} for tenant ${tenantId} under Agent ${agentId}`);
      return { success: true, data };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`ChannelService.createChannel error [${tenantId}]:`, err);
      return { success: false, error: err };
    }
  }

  /**
   * Get a single channel by ID
   */
  async getChannel(tenantId: string, channelId: string, agentId: string = 'system_default'): Promise<Result<Channel>> {
    try {
      const doc = await firebaseService.getDoc(this.getPath(agentId), channelId, tenantId);
      if (!doc) {
        return { success: false, error: new Error(`Channel not found: ${channelId}`) };
      }
      return { success: true, data: doc as Channel };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * List all channels for an agent
   */
  async getChannelsForAgent(tenantId: string, agentId: string): Promise<Result<Channel[]>> {
    try {
      const docs = await firebaseService.getCollection(this.getPath(agentId), tenantId);
      return { success: true, data: docs as Channel[] };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * List all channels across all agents for a tenant.
   * Useful for the Omnichannel Hub (Global View).
   */
  async getAllChannelsAcrossAgents(tenantId: string): Promise<Result<Channel[]>> {
    try {
      const { agentService } = await import('./AgentService.js');
      const agentsResult = await agentService.getAllAgents(tenantId);

      if (!agentsResult.success) return { success: false, error: agentsResult.error };

      const allChannels: Channel[] = [];

      // Ensure system_default is always checked first or included in the list
      await agentService.ensureSystemAgent(tenantId);

      for (const agent of agentsResult.data) {
        const chanResult = await this.getChannelsForAgent(tenantId, agent.id);
        if (chanResult.success) {
          // MASTERMIND Goodie: Memory-State Truth Sync
          const synchronized = chanResult.data.map(chan => this.syncMemoryStatus(chan, tenantId));
          allChannels.push(...synchronized);
        }
      }

      return { success: true, data: allChannels };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Get list of supported platforms from registry
   */
  public getSupportedPlatforms(): PlatformMetadata[] {
    return getSupportedPlatforms();
  }

  /**
   * Synchronize Firestore status with native runtime state.
   * Uses the native ChannelManager's runtime snapshot instead of the deprecated adapter registry.
   */
  private syncMemoryStatus(channel: Channel, tenantId: string): Channel {
    const snapshot = this.getNativeManager(tenantId).getRuntimeSnapshot();
    const accounts = snapshot.channelAccounts[channel.type as ChannelId];
    const isRunning = accounts?.[channel.id]?.running === true;
    let status = channel.status;

    // Do not force 'connected' for WhatsApp channels as they emit accurate fine-grained statuses
    if (isRunning && channel.type !== 'whatsapp' && (status === 'disconnected' || status === 'error')) {
      status = 'connected'; // Sync UP
    } else if (!isRunning && status === 'connected') {
      status = 'disconnected'; // Sync DOWN (stale from crash)
    }

    return {
      ...channel,
      status,
      phoneNumber: channel.phoneNumber || undefined,
    };
  }

  /**
   * Update channel metadata
   */
  async updateChannel(tenantId: string, channelId: string, patch: Partial<Channel>, agentId: string = 'system_default'): Promise<Result<Channel>> {
    try {
      // 1. Optimistic Locking: Verify document version if provided in the patch
      if (patch.updatedAt) {
        const current = await this.getChannel(tenantId, channelId, agentId);
        if (current.success && current.data.updatedAt && (current.data.updatedAt as any).toMillis() !== (patch.updatedAt as any).toMillis()) {
          logger.warn(`Optimistic lock failure for channel ${channelId}: document was modified by another process.`);
          return { success: false, error: new Error('DOCUMENT_STALE: Channel state was modified by another request.') };
        }
      }

      const updateData = {
        ...patch,
        updatedAt: Timestamp.now()
      };
      await firebaseService.setDoc(this.getPath(agentId), channelId, updateData as any, tenantId, true);

      return await this.getChannel(tenantId, channelId, agentId);
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Move a channel from one agent to another
   */
  async moveChannel(tenantId: string, channelId: string, currentAgentId: string, targetAgentId: string): Promise<Result<void>> {
    try {
      if (currentAgentId === targetAgentId) return { success: true, data: undefined };

      // 1. Get existing channel data
      const channelResult = await this.getChannel(tenantId, channelId, currentAgentId);
      if (!channelResult.success) return { success: false, error: channelResult.error };

      const channel = channelResult.data;

      // 2. Create new document at target path
      const updatedChannel = {
        ...channel,
        assignedAgentId: targetAgentId,
        updatedAt: Timestamp.now()
      };
      await firebaseService.setDoc(this.getPath(targetAgentId), channelId, updatedChannel as any, tenantId);

      // 3. Delete old document
      await firebaseService.deleteDoc(this.getPath(currentAgentId), channelId, tenantId);

      logger.info(`Channel ${channelId} moved from ${currentAgentId} to ${targetAgentId}`);
      return { success: true, data: undefined };
    } catch (error: any) {
      logger.error(`Failed to move channel ${channelId}:`, error);
      return { success: false, error };
    }
  }

  /**
   * Find a channel by its ID across all tenants and agents.
   * Uses collectionGroup for efficient global lookup.
   */
  async findChannelByIdGlobally(channelId: string): Promise<Result<{ channel: Channel; tenantId: string; agentId: string }>> {
    try {
      const { db } = await import('@/lib/firebase.js');
      const snapshot = await db.collectionGroup('channels').where('id', '==', channelId).get();

      if (snapshot.empty) {
        return { success: false, error: new Error(`Channel not found globally: ${channelId}`) };
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as Channel;
      
      // Extract tenantId and agentId from path: tenants/{T}/agents/{A}/channels/{C}
      const pathParts = doc.ref.path.split('/');
      const tenantId = pathParts[1];
      const agentId = pathParts[3];

      return { success: true, data: { channel: data, tenantId, agentId } };
    } catch (error: any) {
      logger.error('ChannelService.findChannelByIdGlobally error:', error);
      return { success: false, error };
    }
  }

  /**
   * Start a channel instance (OpenClaw)
   */
  async startChannel(tenantId: string, channelId: string, agentId: string = 'system_default', force: boolean = false): Promise<Result<void>> {
    // Deduplication: Prevent concurrent startChannel calls for same channelId
    const existingStart = this.startingChannels.get(channelId);
    if (existingStart) {
        logger.info(`[ChannelService] Channel ${channelId} is already starting, awaiting existing promise`);
        return existingStart;
    }

    const startPromise = this._doStartChannel(tenantId, channelId, agentId, force);
    this.startingChannels.set(channelId, startPromise);

    try {
        const result = await startPromise;
        return result;
    } finally {
        this.startingChannels.delete(channelId);
    }
  }

  private async _doStartChannel(tenantId: string, channelId: string, agentId: string, force: boolean): Promise<Result<void>> {
    try {
      const channelResult = await this.getChannel(tenantId, channelId, agentId);
      if (!channelResult.success) return { success: false, error: channelResult.error };

      const channel = channelResult.data;
      const pluginId = channel.type as ChannelId;
      const manager = this.getNativeManager(tenantId);

      // Check native runtime to avoid redundant restarts.
      const snapshot = manager.getRuntimeSnapshot();
      const isRunning = snapshot.channelAccounts[pluginId]?.[channelId]?.running === true;
      if (isRunning) {
        if (!force) {
          logger.info(`Channel ${channelId} is already running`);
          return { success: true, data: undefined };
        }
        // force=true: stop the existing native channel so the restart actually takes effect.
        logger.info(`[ChannelService] Force-restarting channel ${channelId} — stopping native channel`);
        await manager.stopChannel(pluginId, channelId);
      }

      // Persist 'connecting' so a crash during handshake doesn't leave stale status.
      await this.updateStatus(tenantId, channelId, 'connecting', agentId);

      // Delegate to the native OpenClaw plugin runtime (replaces AdapterClass dispatch).
      // The native manager uses pluginId ('whatsapp', 'telegram', …) + channelId as accountId.
      await manager.startChannel(pluginId, channelId);

      // Fire-and-forget status sync — native plugin manages its own lifecycle;
      // persist 'connected' as an optimistic marker until plugin emits real status.
      this.updateStatus(tenantId, channelId, 'connected', agentId).catch(err =>
        logger.error(`[ChannelService] Failed to persist connected status for ${channelId}:`, err),
      );

      return { success: true, data: undefined };
    } catch (error: any) {
      logger.error(`Failed to start channel ${channelId}:`, error);
      this.updateStatus(tenantId, channelId, 'error', agentId).catch(() => undefined);
      return { success: false, error };
    }
  }

  /**
   * Stop a channel instance
   */
  async stopChannel(channelId: string, tenantId: string, agentId: string = 'system_default'): Promise<Result<void>> {
    try {
      // 1. Ownership Check: Verify channel belongs to tenant
      const channelResult = await this.getChannel(tenantId, channelId, agentId);
      if (!channelResult.success) {
        return { success: false, error: new Error('UNAUTHORIZED: Tenant does not own this channel.') };
      }

      // Delegate stop to the native OpenClaw plugin runtime.
      const manager = this.getNativeManager(tenantId);
      await manager.stopChannel(channelResult.data.type as ChannelId, channelId);

      // Fire-and-forget Firestore status sync.
      this.updateStatus(tenantId, channelId, 'disconnected', agentId).catch(err =>
        logger.error(`[ChannelService] Failed to persist disconnected status for ${channelId}:`, err),
      );

      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Delete a channel slot
   * STRICT: Shuts down live connection BEFORE deleting/archiving database record.
   */
  async deleteChannel(tenantId: string, channelId: string, agentId: string = 'system_default', options: { archive?: boolean } = {}, userId?: string): Promise<Result<void>> {
    try {
      // 1. Ownership Check (Scenario 34)
      const channel = await this.getChannel(tenantId, channelId, agentId);
      if (!channel.success) {
        return { success: false, error: new Error('UNAUTHORIZED: Tenant does not own this channel.') };
      }

      // 2. Stop any running native channel session before deleting records (Rule 0 / Rule 9 integrity)
      await this.getNativeManager(tenantId)
        .stopChannel(channel.data.type as ChannelId, channelId)
        .catch(() => undefined); // Non-fatal if already stopped

      if (options.archive) {
        // 2a. Mark as archived
        await this.updateStatus(tenantId, channelId, 'archived', agentId);
        logger.info(`Channel archived: ${channelId} for tenant ${tenantId}`);
      } else {
        // 2b. Remove from Firestore
        await firebaseService.deleteDoc(this.getPath(agentId), channelId, tenantId);
        
        // 2c. MASTERMIND Goodie: Cleanup Baileys Auth Credentials (Strict Integrity)
        // Path matches useFirestoreAuthState pattern
        const authPath = `agents/${agentId}/channels/${channelId}/auth`;
        await firebaseService.deleteCollection(authPath, tenantId);
        
        // 2d. Record usage decrement
        trackUsage(userId ?? tenantId, 'channels', -1);

        logger.info(`Channel deleted: ${channelId} from tenant ${tenantId} under Agent ${agentId} (with auth cleanup)`);
      }

      return { success: true, data: undefined };
    } catch (error: any) {
      logger.error(`Failed to delete/archive channel ${channelId}:`, error);
      return { success: false, error };
    }
  }

  /**
   * Resume all active channels across all tenants.
   * STRICT: Used on server boot to restore connectivity.
   */
  async resumeActiveChannels(): Promise<void> {
    logger.info('>>> [MASTERMIND] Resuming all active channels...');
    try {
      const { multiTenantService } = await import('./multiTenantService.js');
      const tenants = await multiTenantService.listTenants();

      let totalStarted = 0;

      for (const tenant of tenants) {
        if (tenant.status !== 'active') continue;

        // Get all channels across all agents for this tenant
        const channelsResult = await this.getAllChannelsAcrossAgents(tenant.id);
        if (!channelsResult.success) continue;

        for (const channel of channelsResult.data) {
          // Restart channels that were previously connected or in error state (retry)
          // 'banned' and 'reconnect_exhausted' require manual user action — never auto-restart.
          // 'logged_out' and 'qr_pending' require user-initiated QR scan — never auto-restart.
          // 'disconnected' means the user intentionally stopped or the QR timed out — never auto-restart.
          const autoRestartStatuses = ['connected', 'connecting', 'error', 'initializing'];
          if (autoRestartStatuses.includes(channel.status)) {
            logger.info(`[ChannelService] Auto-starting channel ${channel.id} (${channel.name}) for tenant ${tenant.id}`);

            // Non-blocking start
            this.startChannel(tenant.id, channel.id, channel.assignedAgentId || undefined).catch(err => {
              logger.error(`[ChannelService] Failed to auto-start channel ${channel.id}:`, err);
            });
            totalStarted++;
          }
        }
      }

      logger.info(`[ChannelService] Successfully queued ${totalStarted} channels for resumption.`);
    } catch (error) {
      logger.error('[ChannelService] Critical error during channel resumption:', error);
    }
  }

  /**
   * Update channel connectivity status
   */
  async updateStatus(tenantId: string, channelId: string, status: Channel['status'], agentId: string = 'system_default'): Promise<void> {
    const result = await this.updateChannel(tenantId, channelId, { status }, agentId);
    if (!result.success) throw result.error;

    // MASTERMIND Wiring: Real-time UI push
    const { socketService } = await import('./socketService.js');
    socketService.emitChannelStatus(tenantId, channelId, status);
  }

  /**
   * Increment channel statistics in Firestore
   */
  async incrementChannelStat(tenantId: string, channelId: string, field: 'messagesSent' | 'messagesReceived' | 'errorsCount', agentId: string = 'system_default'): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: Timestamp.now()
      };
      updateData[`stats.${field}`] = FieldValue.increment(1);

      await firebaseService.setDoc(
        this.getPath(agentId),
        channelId,
        updateData,
        tenantId,
        true
      );
    } catch (err) {
      logger.error(`[ChannelService] Failed to increment stat ${field} for channel ${channelId}:`, err);
    }
  }

  // ── Channel Watchdog (replaces deleted ChannelWatchdog.ts) ─────────────────
  // The ChannelWatchdog was a separate class that ran a periodic healing loop
  // over all tenants/channels. Per the fusion plan, that logic is dissolved
  // here — ChannelService already has all the context (multiTenantService,
  // getAllChannelsAcrossAgents, startChannel) needed to self-heal.

  private watchdogIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the periodic channel healing watchdog.
   * Re-uses resumeActiveChannels() as the healing function — it already
   * correctly skips banned/logged-out/disconnected channels.
   *
   * @param intervalMs - Check interval in ms (default: 60 seconds)
   */
  public startWatchdog(intervalMs: number = 60_000): void {
    if (this.watchdogIntervalId) return; // already running
    logger.info(`>>> [MASTERMIND] Starting ChannelService watchdog (interval: ${intervalMs}ms)`);
    this.watchdogIntervalId = setInterval(() => {
      this.resumeActiveChannels().catch(err => {
        logger.error('[ChannelService] Watchdog healing loop failed:', err);
      });
    }, intervalMs);
    if (this.watchdogIntervalId.unref) this.watchdogIntervalId.unref();
  }

  /**
   * Stop the channel healing watchdog.
   * Call during graceful shutdown.
   */
  public stopWatchdog(): void {
    if (this.watchdogIntervalId) {
      clearInterval(this.watchdogIntervalId);
      this.watchdogIntervalId = null;
      logger.info('<<< [MASTERMIND] Stopped ChannelService watchdog');
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get the current QR code for a channel (image DataURL)
   * QR exposure via native plugin runtime is not yet implemented; returns null.
   */
  public getChannelQR(_channelId: string): string | null {
    return null;
  }

  /**
   * Request a pairing code for a channel
   * Pairing code injection via native plugin runtime is not yet implemented.
   */
  public async requestPairingCode(tenantId: string, channelId: string, _phoneNumber: string, agentId: string = 'system_default'): Promise<Result<string>> {
    try {
      await this.startChannel(tenantId, channelId, agentId);
      return { success: false, error: new Error('Pairing code not supported via native runtime yet') };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Get global stats for dashboard
   */
  public getGlobalStats() {
    const snapshot = this.getSharedNativeManager().getRuntimeSnapshot();
    const activeChannels = Object.values(snapshot.channels).filter(
      (c) => c?.running === true,
    ).length;
    return {
      activeChannels,
      totalAdapters: activeChannels,
      runningProcesses: 1,
    };
  }

  /**
   * Get simple list of active channel IDs
   */
  public getActiveChannelIds() {
    const snapshot = this.getSharedNativeManager().getRuntimeSnapshot();
    return Object.entries(snapshot.channels)
      .filter(([, c]) => c?.running === true)
      .map(([id]) => ({ id, isActive: true }));
  }
}

export const channelService = ChannelService.getInstance();
export default channelService;
