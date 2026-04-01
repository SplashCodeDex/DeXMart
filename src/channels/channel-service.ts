import { firebaseService } from '@/services/FirebaseService.js';
import { Channel, ChannelSchema, Result } from '../types/contracts.js';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import logger from '@/utils/logger.js';
import crypto from 'crypto';
import { channelManager } from './channels/ChannelManager.js';
import { getPlatformAdapter, getSupportedPlatforms, PlatformMetadata } from './channels/registry.js';
import { systemAuthorityService } from './SystemAuthorityService.js';

/**
 * Channel Service
 *
 * Manages the lifecycle of connectivity slots.
 * Operates within the Agent hierarchy: tenants/T/agents/A/channels/C.
 */
export class ChannelService {
  private static instance: ChannelService;
  private startingChannels: Map<string, Promise<Result<void>>> = new Map();

  private constructor() { }

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
  async createChannel(tenantId: string, channelData: Partial<Channel>, agentId: string = 'system_default'): Promise<Result<Channel>> {
    try {
      // 1. Check authority for channel creation
      const auth = await systemAuthorityService.checkAuthority(tenantId, 'add_channel');
      if (!auth.allowed) {
        throw new Error(auth.error || 'Channel slot limit reached for your current plan.');
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
      await systemAuthorityService.recordUsage(tenantId, 'channels', 1);

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
          const synchronized = chanResult.data.map(chan => this.syncMemoryStatus(chan));
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
   * Synchronize Firestore status with real memory state
   */
  private syncMemoryStatus(channel: Channel): Channel {
    const isInMemory = !!channelManager.getAdapter(channel.id);
    let status = channel.status;

    // Do not force 'connected' for WhatsApp channels as they emit accurate fine-grained statuses (qr_pending, disconnected, error)
    if (isInMemory && channel.type !== 'whatsapp' && (status === 'disconnected' || status === 'error')) {
      status = 'connected'; // Sync UP
    } else if (!isInMemory && status === 'connected') {
      status = 'disconnected'; // Sync DOWN (stale from crash)
    }

    return {
      ...channel,
      status,
      phoneNumber: channel.phoneNumber || undefined
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

      // 4. Update memory adapter if running
      const adapter = channelManager.getAdapter(channelId);
      if (adapter && adapter.updatePath) {
        const newPath = `tenants/${tenantId}/agents/${targetAgentId}/channels/${channelId}`;
        adapter.updatePath(newPath);
        logger.info(`Channel ${channelId} adapter path updated to ${newPath}`);
      }

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
    if (channelManager.getAdapter(channelId)) {
      logger.info(`Channel ${channelId} is already running`);
      return { success: true, data: undefined };
    }

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
      const fullPath = `tenants/${tenantId}/agents/${agentId}/channels/${channelId}`;

      // Initialize Adapter from Registry
      const AdapterClass = getPlatformAdapter(channel.type);
      if (!AdapterClass) {
        return { success: false, error: new Error(`Unsupported channel type: ${channel.type}`) };
      }

      let adapter = new AdapterClass(tenantId, channelId, fullPath, channel as any);
      
      if (channel.type === 'whatsapp') {
        // --- MIDDLEWARE INJECTION ---
        const { default: mainMiddleware } = await import('../middleware/main.js');
        const gCtx = await (await import('../lib/context.js')).default();
        mainMiddleware(adapter as any, gCtx);
        (adapter as any).setContext(gCtx);

        adapter.onMessage(async (event: any) => {
          const { ingressService } = await import('./IngressService.js');
          const context = await (await import('../lib/context.js')).default();
          this.incrementChannelStat(tenantId, channelId, 'messagesReceived', agentId);
          await ingressService.handleMessage(tenantId, channelId, event.raw, context, fullPath);
        });
      } else {
        adapter.onMessage(async (event: any) => {
          const { ingressService } = await import('./IngressService.js');
          const context = await (await import('../lib/context.js')).default();
          this.incrementChannelStat(tenantId, channelId, 'messagesReceived', agentId);

          await ingressService.handleCommonMessage(tenantId, channelId, {
            id: event.raw?.id || event.raw?.message_id?.toString() || crypto.randomUUID(),
            platform: channel.type as any,
            from: event.sender,
            to: channelId,
            content: { text: event.content },
            timestamp: event.timestamp instanceof Date ? event.timestamp.getTime() : new Date(event.timestamp).getTime(),
            metadata: { raw: event.raw, fullPath }
          }, context, fullPath);
        });
      }

      await adapter.initialize(); // Essential for Telegram to run bot.init()

      // Register BEFORE connect() so the Watchdog sees the adapter as alive
      // during the QR-pending phase (WhatsApp connect() blocks until handshake).
      channelManager.registerAdapter(adapter);

      await adapter.connect(force);

      // Only mark as connected if it's not managed by the adapter itself (like WhatsApp)
      if (channel.type !== 'whatsapp') {
        await this.updateStatus(tenantId, channelId, 'connected', agentId);
      }

      return { success: true, data: undefined };
    } catch (error: any) {
      logger.error(`Failed to start channel ${channelId}:`, error);
      // Unregister the adapter on failure so it's not left dangling
      await channelManager.shutdownAdapter(channelId);
      await this.updateStatus(tenantId, channelId, 'error', agentId);
      return { success: false, error };
    }
  }

  /**
   * Stop a channel instance
   */
  async stopChannel(channelId: string, tenantId: string, agentId: string = 'system_default'): Promise<Result<void>> {
    try {
      // 1. Ownership Check (Scenario 34): Verify channel belongs to tenant
      const channel = await this.getChannel(tenantId, channelId, agentId);
      if (!channel.success) {
        return { success: false, error: new Error('UNAUTHORIZED: Tenant does not own this channel.') };
      }

      await channelManager.shutdownAdapter(channelId);
      await this.updateStatus(tenantId, channelId, 'disconnected', agentId);
      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Delete a channel slot
   * STRICT: Shuts down live connection BEFORE deleting/archiving database record.
   */
  async deleteChannel(tenantId: string, channelId: string, agentId: string = 'system_default', options: { archive?: boolean } = {}): Promise<Result<void>> {
    try {
      // 1. Ownership Check (Scenario 34)
      const channel = await this.getChannel(tenantId, channelId, agentId);
      if (!channel.success) {
        return { success: false, error: new Error('UNAUTHORIZED: Tenant does not own this channel.') };
      }

      // 2. Kill live session in memory (Rule 0 / Rule 9 integrity)
      await channelManager.shutdownAdapter(channelId);

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
        await systemAuthorityService.recordUsage(tenantId, 'channels', -1);

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

  /**
   * Get the current QR code for a channel (image DataURL)
   */
  public getChannelQR(channelId: string): string | null {
    const adapter = channelManager.getAdapter(channelId);
    if (adapter && (adapter as any).getQR) {
      return (adapter as any).getQR();
    }
    return null;
  }

  /**
   * Request a pairing code for a channel
   */
  public async requestPairingCode(tenantId: string, channelId: string, phoneNumber: string, agentId: string = 'system_default'): Promise<Result<string>> {
    try {
      let adapter = channelManager.getAdapter(channelId);
      if (!adapter) {
        // Start if not running
        await this.startChannel(tenantId, channelId, agentId);
        adapter = channelManager.getAdapter(channelId);
      }

      if (adapter && (adapter as any).requestPairingCode) {
        const code = await (adapter as any).requestPairingCode(phoneNumber);
        return { success: true, data: code };
      }
      return { success: false, error: new Error('Pairing code not supported for this channel') };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Get global stats for dashboard
   */
  public getGlobalStats() {
    const keys = channelManager.getRegisteredChannelKeys();
    return {
      activeChannels: keys.length,
      totalAdapters: keys.length,
      runningProcesses: 1
    };
  }

  /**
   * Get simple list of active channel IDs
   */
  public getActiveChannelIds() {
    return channelManager.getRegisteredChannelKeys().map(id => ({ id, isActive: true }));
  }
}

export const channelService = ChannelService.getInstance();
export default channelService;
