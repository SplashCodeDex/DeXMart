
import { CommonMessage } from '../../../types/omnichannel.js';
import { ChannelAdapter, InboundMessageEvent } from '../ChannelAdapter.js';
import AuthSystem from '@/services/authSystem.js';
import logger from '@/utils/logger.js';
import { eventHandler } from '@/services/eventHandler.js';
import QRCode from 'qrcode';
import { MiddlewareSystem } from '@/services/middlewareSystem.js';
import { Channel } from '../../../types/contracts.js';
import { ActiveChannel, MessageContext, Middleware } from '../../../types/index.js';
import { jobQueueService } from '@/services/jobQueue.js';

import { getWebOutbound, getWebActiveListener } from '@/utils/openclawImports.js';
import type { ActiveWebListener, ActiveWebSendOptions } from 'openclaw';

/**
 * WhatsappAdapter wraps the existing DeXMart Baileys/AuthSystem logic
 * to conform to the ChannelAdapter interface.
 */
export class WhatsappAdapter implements ChannelAdapter, Partial<ActiveChannel> {
  public readonly id = 'whatsapp';
  public readonly instanceId: string;
  public fullPath?: string;
  private authSystem: AuthSystem;
  private messageHandler: ((event: InboundMessageEvent) => Promise<void>) | null = null;
  private socket: any = null;
  private qrCodeUrl: string | null = null;
  private middlewareSystem = new MiddlewareSystem();
  public config: any = {}; // Holds channel settings like selfMode, alwaysOnline
  public channelId: string; // Map instanceId to channelId for index.ts Channel type
  public context: any; // Injected GlobalContext
  public status: string = 'disconnected';
  private presenceInterval: NodeJS.Timeout | null = null;
  private isDisconnecting: boolean = false;
  private activeDownloads: number = 0;
  private maxParallelDownloads: number = 5;
  private qrGenerationCount: number = 0;
  private qrTimeoutHandle: NodeJS.Timeout | null = null;
  private static readonly QR_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  constructor(public tenantId: string, channelId: string, fullPath?: string, channelData?: Partial<Channel>) {
    this.instanceId = channelId;
    this.channelId = channelId;
    this.fullPath = fullPath;
    this.config = channelData?.config || {};

    // Resolve the partial path for session storage (agents/A/channels/C)
    let collectionOrPath = 'channels';
    if (fullPath && fullPath.includes('/agents/')) {
      const parts = fullPath.split('/');
      // Extract 'agents/{agentId}/channels'
      collectionOrPath = `agents/${parts[3]}/channels`;
    }

    this.authSystem = new AuthSystem(
      { channel: { deviceName: this.config.deviceName, proxyUrl: this.config.proxyUrl } },
      tenantId,
      channelId,
      collectionOrPath
    );
  }

  /**
   * Triggers a Mastermind Delta-Sync for groups.
   * This queues a background job with priority for active chats.
   */
  private async triggerGroupSync() {
    if (!this.socket) return;

    logger.info(`[WhatsappAdapter] Triggering Group Sync for ${this.channelId}`);

    // 1. Get chats to identify "hot" groups
    const chats = this.socket.store?.chats?.all() || [];
    const groupJids = chats
      .filter((c: any) => c.id.endsWith('@g.us'))
      .map((c: any) => c.id);

    // 2. Queue Priority Job for these groups
    if (groupJids.length > 0) {
      await (jobQueueService as any).addJob('group-sync', 'sync-priority', {
        tenantId: this.tenantId,
        channelId: this.channelId,
        groupJids,
        type: 'priority'
      }, { priority: 1 });
    }

    // 3. Queue Cold Sync for all other potential groups (background)
    await (jobQueueService as any).addJob('group-sync', 'sync-cold', {
      tenantId: this.tenantId,
      channelId: this.channelId,
      type: 'cold'
    }, { priority: 10 });
  }

  // CHANNEL INTERFACE IMPLEMENTATION
  public use(middleware: Middleware): void {
    this.middlewareSystem.use(middleware);
  }

  public async executeMiddleware(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    await this.middlewareSystem.execute(ctx, next);
  }

  /**
   * Inject GlobalContext for bridge compatibility
   */
  public setContext(context: any) {
    this.context = context;
  }

  public updatePath(newPath: string): void {
    logger.info(`WhatsappAdapter ${this.channelId} path updated from ${this.fullPath} to ${newPath}`);
    this.fullPath = newPath;

    // MASTERMIND Fix: Synchronize AuthSystem path to prevent session desync (Scenario 3)
    if (newPath.includes('/agents/')) {
       const parts = newPath.split('/');
       const agentCollectionPath = `agents/${parts[3]}/channels`;
       this.authSystem.updatePath(agentCollectionPath);
    }
  }

  public async initialize(): Promise<void> {
    // Basic init if needed
  }

  public async connect(forceNewSession: boolean = false): Promise<void> {
    logger.info(`Connecting WhatsappAdapter for channel ${this.channelId}. Force: ${forceNewSession}`);
    this.isDisconnecting = false;
    this.qrGenerationCount = 0;

    // Cleanup: Remove old socket event listeners before creating a new one
    if (this.socket && this.socket.ev) {
      try { this.socket.ev.removeAllListeners('connection.update'); } catch (e) {}
      try { this.socket.ev.removeAllListeners('messages.upsert'); } catch (e) {}
    }

    // Cleanup: Remove old AuthSystem event listeners before attaching new ones
    try { this.authSystem.removeAllListeners('qr'); } catch (e) {}
    try { this.authSystem.removeAllListeners('status'); } catch (e) {}

    // Step 0: Ensure OpenClaw is ready BEFORE we attempt AuthSystem
    const loadResult = await getWebActiveListener().catch((err) => {
        logger.error('[WhatsappAdapter] Failed to load web active listener', err);
        throw new Error('Failed to initialize OpenClaw web active listener');
    });

    // MASTERMIND Goodie: Listen for QR codes and convert to DataURL for UI
    // MUST be attached before connect() to catch early events
    this.authSystem.on('qr', async (qr) => {
      this.qrGenerationCount++;
      try {
        const dataUrl = await QRCode.toDataURL(qr);
        this.qrCodeUrl = dataUrl;

        // MASTERMIND Goodie: Real-time Socket Push
        const { socketService } = await import('@/services/socketService.js');
        socketService.emitQRCode(this.tenantId, this.channelId, dataUrl);

        if (this.qrGenerationCount >= 4) {
          logger.warn(`[WhatsappAdapter] QR code regenerated ${this.qrGenerationCount} times for ${this.channelId}. User may not be scanning.`);
        }

        // Start the QR scan timeout on first QR generation.
        // If the user never scans within QR_TIMEOUT_MS, disconnect and set status to
        // 'disconnected' so the channel is dormant until the user manually reconnects.
        if (this.qrGenerationCount === 1 && !this.qrTimeoutHandle) {
          this.qrTimeoutHandle = setTimeout(async () => {
            if (this.status === 'qr_pending') {
              logger.warn(`[WhatsappAdapter] QR scan timeout for ${this.channelId}. Setting to disconnected.`);
              await this.disconnect();
              try {
                const { channelService } = await import('@/services/ChannelService.js');
                let agentId = 'system_default';
                if (this.fullPath && this.fullPath.includes('/agents/')) {
                  agentId = this.fullPath.split('/')[3];
                }
                await channelService.updateStatus(this.tenantId, this.channelId, 'disconnected' as any, agentId);
              } catch (err) {
                logger.error(`[WhatsappAdapter] Failed to update status after QR timeout for ${this.channelId}`, err);
              }
            }
            this.qrTimeoutHandle = null;
          }, WhatsappAdapter.QR_TIMEOUT_MS);
        }
      } catch (err) {
        logger.error('Failed to generate QR DataURL', err);
      }
    });

    // MASTERMIND Goodie: Forward AuthSystem status updates to ChannelService
    this.authSystem.on('status', async (status: string) => {
      this.status = status;
      try {
        const { channelService } = await import('@/services/ChannelService.js');
        let agentId = 'system_default';
        if (this.fullPath && this.fullPath.includes('/agents/')) {
          agentId = this.fullPath.split('/')[3];
        }
        await channelService.updateStatus(this.tenantId, this.channelId, status as any, agentId);
      } catch (err: any) {
        logger.error(`Failed to forward status '${status}' for ${this.channelId}`, err);
      }
    });

    const connectResult = await this.authSystem.connect(forceNewSession);

    // MASTERMIND Resilience: If disconnect() was called while we were waiting
    if (this.isDisconnecting) {
      logger.warn(`[WhatsappAdapter] Connection aborted for ${this.channelId} due to concurrent disconnect`);
      if (connectResult.success && connectResult.data) {
        try { connectResult.data.end(undefined); } catch (e) { }
      }
      return;
    }

    if (!connectResult.success) {
      throw (connectResult as any).error;
    }

    this.socket = connectResult.data;

    if (!this.socket) {
      logger.warn(`[WhatsappAdapter] Socket lost during connection phase for ${this.channelId}`);
      return;
    }

    // MASTERMIND Goodie: Bind EventHandler for Anti-Call and Group Sync
    eventHandler.bind(this.socket as any);

    // Sync any existing QR captured during connection establishment
    const existingQr = await this.authSystem.getQRCode();
    if (existingQr.success && existingQr.data) {
      this.qrCodeUrl = await QRCode.toDataURL(existingQr.data);
    }

    // MASTERMIND Goodie: Automatic Phone Number Discovery
    this.socket.ev.on('connection.update', async (update: any) => {
      if (!this.socket) return;
      if (update.connection === 'open' && update.me?.id) {
        this.qrCodeUrl = null; // Clear QR on success
        this.qrGenerationCount = 0; // Reset QR counts
        if (this.qrTimeoutHandle) {
          clearTimeout(this.qrTimeoutHandle);
          this.qrTimeoutHandle = null;
        }
        const phoneNumber = update.me.id.split(':')[0];
        logger.info(`Channel ${this.channelId} connected with number: ${phoneNumber}`);

        // --- ALWAYS ONLINE LOGIC ---
        if (this.config.alwaysOnline) {
          logger.info(`[WhatsappAdapter] Enabling AlwaysOnline for ${this.channelId}`);
          await this.socket.sendPresenceUpdate('available');

          // Periodic keep-alive
          if (this.presenceInterval) clearInterval(this.presenceInterval);
          this.presenceInterval = setInterval(async () => {
            try {
              if (this.socket) await this.socket.sendPresenceUpdate('available');
            } catch (e) {
              logger.warn(`[WhatsappAdapter] Failed to send keep-alive for ${this.channelId}`, e);
            }
          }, 5 * 60 * 1000); // 5 minutes
        }

        // --- DELTA-SYNC TRIGGER ---
        // Trigger non-blocking priority group sync after connection
        this.triggerGroupSync().catch((err: any) =>
          logger.error(`[WhatsappAdapter] Failed to trigger group sync for ${this.channelId}`, err)
        );

        try {
          const { channelService } = await import('@/services/ChannelService.js');
          let agentId = 'system_default';
          if (this.fullPath && this.fullPath.includes('/agents/')) {
            agentId = this.fullPath.split('/')[3];
          }
          await channelService.updateChannel(this.tenantId, this.channelId, { phoneNumber }, agentId);
        } catch (e) {
          logger.error(`Failed to update discovered phone number for ${this.channelId}`, e);
        }
      }
    });

    // Register active web listener for OpenClaw's outbound pipeline
    const listener: ActiveWebListener = {
      sendMessage: async (to: string, text: string, mediaBuffer?: Buffer, mediaType?: string, options?: ActiveWebSendOptions) => {
        const payload: any = {};
        if (mediaBuffer && mediaType) {
          if (mediaType.startsWith('image/')) {
            payload.image = mediaBuffer;
            payload.caption = text;
          } else if (mediaType.startsWith('video/')) {
            payload.video = mediaBuffer;
            payload.caption = text;
            if (options?.gifPlayback) payload.gifPlayback = true;
          } else if (mediaType.startsWith('audio/')) {
            payload.audio = mediaBuffer;
          } else {
            payload.document = mediaBuffer;
            payload.mimetype = mediaType;
            payload.fileName = options?.fileName || 'document';
            payload.caption = text;
          }
        } else {
          payload.text = text;
        }
        let result: any;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          try {
            if (!this.socket || this.status !== 'connected') {
              throw new Error('Socket not connected');
            }
            result = await this.socket.sendMessage(to, payload);
            break; // Success
          } catch (error: any) {
            retryCount++;
            const isStreamClosed = error?.message?.includes('Stream Closed') || error?.message?.includes('connection closed');
            const isSocketDead = error?.message?.includes('Socket not connected');
            if ((isStreamClosed || isSocketDead) && retryCount <= maxRetries) {
              logger.warn(`[WhatsappAdapter] sendMessage failed. Retrying ${retryCount}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Longer delay for reconnect
              continue;
            }
            throw error;
          }
        }

        // Track stats
        try {
          const { channelService } = await import('@/services/ChannelService.js');
          let agentId = 'system_default';
          if (this.fullPath && this.fullPath.includes('/agents/')) {
            agentId = this.fullPath.split('/')[3];
          }
          await channelService.incrementChannelStat(this.tenantId, this.channelId, 'messagesSent', agentId);
        } catch (e) {
          logger.warn('Failed to increment stats in WhatsappAdapter', e);
        }

        return { messageId: result?.key?.id || '' };
      },
      sendPoll: async (to: string, poll: any) => {
        const result = await this.socket.sendMessage(to, {
          poll: {
            name: poll.question,
            values: poll.options.map((opt: any) => typeof opt === 'string' ? opt : opt.name),
            selectableCount: poll.maxSelections || 1,
          }
        });
        return { messageId: result?.key?.id || '' };
       },
       sendReaction: async (chatJid: string, messageId: string, emoji: string, fromMe: boolean, participant?: string) => {
         await this.socket.sendMessage(chatJid, { react: { text: emoji, key: { id: messageId, fromMe, remoteJid: chatJid, participant } } });
       },
       sendComposingTo: async (to: string) => {
         await this.socket.sendPresenceUpdate('composing', to);
       },
     };
     const listenerModule = await getWebActiveListener().catch((err) => {
       logger.error('[WhatsappAdapter] Failed to load web active listener for setting', err);
       return null;
     });
     if (listenerModule?.setActiveWebListener) {
       listenerModule.setActiveWebListener(this.channelId, listener);
     }

    // Listen for messages
    this.socket.ev.on('messages.upsert', async ({ messages, type }: any) => {
      if (type === 'notify' && this.messageHandler) {
        // Scenario 30: On reconnect, Baileys can flush 1000+ pending messages in a single
        // upsert batch. Processing them synchronously in a tight loop causes memory spikes
        // and blocks the event loop. Stream them in chunks with event-loop yields between
        // each chunk so other I/O (heartbeats, QR updates) stays responsive.
        const CHUNK_SIZE = 20;
        for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
          const chunk = messages.slice(i, i + CHUNK_SIZE);
          for (const message of chunk) {
            // Ignore messages sent by the bot itself unless selfMode is enabled
            if (message.key.fromMe && !this.config?.selfMode) {
              continue;
            }
            try {
              await this.messageHandler({
                tenantId: this.tenantId,
                channelId: this.channelId,
                channelType: 'whatsapp',
                fullPath: this.fullPath,
                sender: message.key.remoteJid,
                content: message.message,
                timestamp: new Date((message.messageTimestamp as number) * 1000),
                raw: message
              });
            } catch (msgErr) {
              // Per-message catch: log and continue processing the rest of the batch
              logger.error(`[WhatsappAdapter] Failed to handle message from ${message.key.remoteJid}:`, msgErr);
            }
          }
          // Yield to event loop between chunks
          if (i + CHUNK_SIZE < messages.length) {
            await new Promise(resolve => setImmediate(resolve));
          }
        }
      }
    });
  }

  public async disconnect(): Promise<void> {
    this.isDisconnecting = true;
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
    if (this.qrTimeoutHandle) {
      clearTimeout(this.qrTimeoutHandle);
      this.qrTimeoutHandle = null;
    }

    // Remove socket event listeners to prevent memory leaks
    if (this.socket && this.socket.ev) {
      try { this.socket.ev.removeAllListeners('connection.update'); } catch (e) {}
      try { this.socket.ev.removeAllListeners('messages.upsert'); } catch (e) {}
    }

    // Remove AuthSystem event listeners to prevent memory leaks
    try { this.authSystem.removeAllListeners('qr'); } catch (e) {}
    try { this.authSystem.removeAllListeners('status'); } catch (e) {}

    const listenerModule = await getWebActiveListener();
    if (listenerModule?.setActiveWebListener) {
      listenerModule.setActiveWebListener(this.channelId, null);
    }
    await this.authSystem.disconnect();
    this.socket = null;

    // MASTERMIND Resilience: Cleanup pending outbound jobs (Scenario 19)
    try {
      const { jobQueueService } = await import('@/services/jobQueue.js');
      await jobQueueService.removeJobsByChannelId(this.channelId, 'whatsapp-outbound');
      logger.info(`[WhatsappAdapter] Cleaned up pending outbound jobs for stopped channel ${this.channelId}`);
    } catch (err) {
      logger.warn(`[WhatsappAdapter] Failed to cleanup jobs during shutdown for ${this.channelId}`, err);
    }
  }

  public async shutdown(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Public sendMessage pushes to a background queue to prevent bans
   */
  public async sendMessage(target: string, content: any): Promise<void> {
    const jid = target.includes('@s.whatsapp.net') ? target : `${target}@s.whatsapp.net`;
    const { jobQueueService } = await import('@/services/jobQueue.js');

    logger.info(`Queuing outbound WhatsApp message for ${jid}`);

    await jobQueueService.addJob('whatsapp-outbound', 'send-message', {
      tenantId: this.tenantId,
      channelId: this.channelId,
      jid,
      message: content,
      options: {
        verbose: false,
        accountId: this.channelId,
      }
    });
  }

  /**
   * Internal method used by the worker to actually dispatch the message
   * after the human-like delay has passed.
   */
  public async _directSendMessage(target: string, content: any, options: any): Promise<void> {
    if (!this.socket) {
      throw new Error('Adapter not connected');
    }

    const text = typeof content === 'string' ? content : (content.text || '');
    const mediaUrl = content.mediaUrl;

    // Dispatch via OpenClaw's pipeline
    const outboundModule = await getWebOutbound();
    if (outboundModule?.sendMessageWhatsApp) {
      await outboundModule.sendMessageWhatsApp(target, text, {
        ...options,
        mediaUrl
      });
    } else {
      throw new Error('sendMessageWhatsApp fallback failed to load');
    }

    // Track stats
    try {
      const { channelService } = await import('@/services/ChannelService.js');
      let agentId = 'system_default';
      if (this.fullPath && this.fullPath.includes('/agents/')) {
        agentId = this.fullPath.split('/')[3];
      }
      await channelService.incrementChannelStat(this.tenantId, this.channelId, 'messagesSent', agentId);
    } catch (e) {
      logger.warn('Failed to increment stats in WhatsappAdapter', e);
    }
  }

  public getSocket() {
    return this.socket;
  }

  public async sendReaction(chatJid: string, messageId: string, emoji: string): Promise<void> {
    if (!this.socket) throw new Error('Adapter not connected');
    const outboundModule = await getWebOutbound();
    if (outboundModule?.sendReactionWhatsApp) {
      await outboundModule.sendReactionWhatsApp(chatJid, messageId, emoji, {
        verbose: false,
        accountId: this.channelId
      });
    }
  }

  public async sendPoll(to: string, question: string, options: string[]): Promise<void> {
    if (!this.socket) throw new Error('Adapter not connected');
    const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
    const outboundModule = await getWebOutbound();
    if (outboundModule?.sendPollWhatsApp) {
      await outboundModule.sendPollWhatsApp(jid, { question, options }, {
        verbose: false,
        accountId: this.channelId
      });
    }
  }

  public async sendCommon(message: CommonMessage): Promise<void> {
    // Phase 1.3: Robust formatting is handled by OpenClaw's convertMarkdownTables and markdownToWhatsApp automatically!
    await this.sendMessage(message.to, {
      text: message.content.text || '',
      mediaUrl: message.content.attachments?.[0]?.url
    });
  }

  public onMessage(handler: (event: InboundMessageEvent) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /**
   * Get the current QR code image URL
   */
  public getQR(): string | null {
    return this.qrCodeUrl;
  }

  /**
   * Request a pairing code
   */
  public async requestPairingCode(phoneNumber: string): Promise<string> {
    const result = await this.authSystem.getPairingCode(phoneNumber);
    if (!result.success) throw result.error;
    return result.data;
  }
}
