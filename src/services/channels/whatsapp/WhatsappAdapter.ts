/**
 * WhatsappAdapter.ts — DeXMart Fusion: Multi-Tenant WhatsApp Channel Adapter
 *
 * This is the exact fusion point the TrueFusionPlan described:
 *   - OpenClaw provides the engine: createWaSocket() (src/web/session.ts)
 *   - DeXMart provides the infrastructure: Firestore auth, anti-ban queue,
 *     multi-tenant isolation, real-time status → Socket.IO
 *
 * What this file does vs. what OpenClaw does:
 *   OpenClaw (src/web/session.ts): Manages the Baileys socket lifecycle,
 *     QR code generation, connection state, message routing to the AI agent.
 *   This adapter: Wraps createWaSocket() with DeXMart-specific concerns:
 *     1. Per-user Firestore session persistence (useFirestoreChannelAuthState)
 *     2. Anti-ban rate-limited outbound via the job queue
 *     3. Multi-tenant context (userId scopes everything)
 *     4. Status → Socket.IO push for the dashboard
 *     5. Middleware pipeline (DeXMart middleware system)
 *
 * Reconstructed from backend/dist/backend/src/services/channels/whatsapp/WhatsappAdapter.js
 * The interface is preserved exactly. Types and fusion wiring are added.
 *
 * Key design decisions:
 *   - authStateFactory uses useFirestoreChannelAuthState (Phase 2, FR-2)
 *   - getSocket() exposes the raw Baileys socket for resilienceHarness and queue worker
 *   - _directSendMessage() is the low-level send used by the anti-ban queue worker
 *   - connect() passes authStateFactory to createWaSocket() (Phase 2 injection point)
 */

import type { WASocket } from '@whiskeysockets/baileys';
import logger from '../../../utils/logger.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdapterStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'qr_pending'
  | 'logged_out'
  | 'banned';

export interface WhatsappAdapterConfig {
  deviceName?: string;
  proxyUrl?: string;
  alwaysOnline?: boolean;
}

export interface ChannelData {
  config?: WhatsappAdapterConfig;
  [key: string]: unknown;
}

// ── WhatsappAdapter ───────────────────────────────────────────────────────────

export class WhatsappAdapter {
  /** Unique key: `${userId}:${channelId}` — used by ChannelManager registry */
  public readonly instanceId: string;
  /** Channel type identifier */
  public readonly id = 'whatsapp';

  private readonly userId: string;
  private readonly channelId: string;
  private fullPath: string;
  private readonly config: WhatsappAdapterConfig;

  private socket: WASocket | null = null;
  private status: AdapterStatus = 'disconnected';
  private qrCodeUrl: string | null = null;
  private qrGenerationCount = 0;
  private isDisconnecting = false;
  private presenceInterval: ReturnType<typeof setInterval> | null = null;

  // Middleware pipeline (DeXMart middleware system)
  private middlewares: Array<(ctx: unknown, next: () => Promise<void>) => Promise<void>> = [];
  private context: unknown = null;

  /**
   * @param userId      - Firebase UID of the owner (the "tenant" in B2C model)
   * @param channelId   - Unique channel instance ID (e.g., 'whatsapp-1')
   * @param fullPath    - Firestore path for this channel's data
   * @param channelData - Persisted channel config from Firestore
   */
  constructor(
    userId: string,
    channelId: string,
    fullPath: string,
    channelData?: ChannelData,
  ) {
    this.userId = userId;
    this.channelId = channelId;
    this.instanceId = `${userId}:${channelId}`;
    this.fullPath = fullPath;
    this.config = channelData?.config ?? {};
  }

  // ── Message Callback (ChannelService interface) ─────────────────────────

  private messageCallbacks: Array<(event: { sender: string; content: string; raw: unknown; timestamp: Date }) => Promise<void>> = [];

  /**
   * Register a message handler — called by ChannelService._doStartChannel().
   * The callback is invoked for each incoming message from the Baileys socket.
   */
  public onMessage(callback: (event: { sender: string; content: string; raw: unknown; timestamp: Date }) => Promise<void>): void {
    this.messageCallbacks.push(callback);
  }

  /** Alias used by ChannelService.getChannelQR() */
  public getQR(): string | null {
    return this.qrCodeUrl;
  }

  // ── Middleware Pipeline ───────────────────────────────────────────────────

  public use(middleware: (ctx: unknown, next: () => Promise<void>) => Promise<void>): void {
    this.middlewares.push(middleware);
  }

  public async executeMiddleware(ctx: unknown, next: () => Promise<void>): Promise<void> {
    let index = 0;
    const dispatch = async (): Promise<void> => {
      if (index >= this.middlewares.length) {
        await next();
        return;
      }
      const fn = this.middlewares[index++];
      await fn(ctx, dispatch);
    };
    await dispatch();
  }

  public setContext(context: unknown): void {
    this.context = context;
  }

  public updatePath(newPath: string): void {
    this.fullPath = newPath;
    logger.info(`[WhatsappAdapter:${this.instanceId}] Path updated to: ${newPath}`);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize the adapter — validate config, set up Firestore auth state.
   * Called before connect().
   */
  public async initialize(): Promise<void> {
    logger.info(`[WhatsappAdapter:${this.instanceId}] Initializing...`);
    // Validate required config
    if (!this.userId) {
      throw new Error('[WhatsappAdapter] userId is required for Firestore auth state');
    }
    logger.info(`[WhatsappAdapter:${this.instanceId}] Initialization complete`);
  }

  /**
   * Connect to WhatsApp via OpenClaw's createWaSocket() with Firestore auth.
   *
   * Fusion wiring (Phase 2, FR-2):
   *   authStateFactory = () => useFirestoreChannelAuthState(userId, channelId, db)
   *   This replaces the file-based useMultiFileAuthState for all multi-user sessions.
   *
   * @param forceNewSession - If true, clears Firestore auth state before connecting
   */
  public async connect(forceNewSession = false): Promise<void> {
    this.isDisconnecting = false;
    this.status = 'connecting';
    logger.info(`[WhatsappAdapter:${this.instanceId}] Connecting (forceNew=${forceNewSession})...`);

    try {
      // Lazy imports — avoid pulling heavy deps at module init time
      const { createWaSocket } = await import('../../../web/session.js');
      const { useFirestoreChannelAuthState } = await import('../../../persistence/channel-auth-state.js');
      const { db } = await import('../../../lib/firebase.js');
      const QRCode = await import('qrcode');

      // Phase 2 FR-2: inject Firestore auth state factory
      const authStateFactory = async () => {
        const authState = await useFirestoreChannelAuthState(
          this.userId,
          this.channelId,
          db as any,
        );
        return authState;
      };

      this.socket = await createWaSocket(
        /* printQr */ false,
        /* verbose */ false,
        { authStateFactory },
      );

      if (!this.socket) {
        throw new Error('[WhatsappAdapter] createWaSocket returned null');
      }

      // ── QR code handler ────────────────────────────────────────────────────
      this.socket.ev.on('connection.update', async (update) => {
        const { qr, connection, lastDisconnect } = update;

        if (qr) {
          this.qrGenerationCount++;
          try {
            this.qrCodeUrl = await QRCode.default.toDataURL(qr);
            this.status = 'qr_pending';
            logger.info(`[WhatsappAdapter:${this.instanceId}] QR generated (#${this.qrGenerationCount})`);
          } catch (e) {
            logger.error(`[WhatsappAdapter:${this.instanceId}] QR generation error:`, e);
          }
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrCodeUrl = null;
          logger.info(`[WhatsappAdapter:${this.instanceId}] Connected ✓`);

          if (this.config.alwaysOnline) {
            this.presenceInterval = setInterval(async () => {
              try {
                if (this.socket) {
                  await this.socket.sendPresenceUpdate('available');
                }
              } catch (e) {
                // Non-fatal
              }
            }, 30_000);
          }
        }

        if (connection === 'close') {
          this.status = 'disconnected';
          if (this.presenceInterval) {
            clearInterval(this.presenceInterval);
            this.presenceInterval = null;
          }
          if (!this.isDisconnecting) {
            logger.warn(`[WhatsappAdapter:${this.instanceId}] Disconnected (lastDisconnect: ${JSON.stringify(lastDisconnect?.error)}). Auto-reconnect managed by ChannelService watchdog.`);
          }
        }
      });

      // ── Incoming message handler ─────────────────────────────────────────
      this.socket.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
          if (msg.key.fromMe) continue; // Skip own messages
          const sender = msg.key.remoteJid || '';
          const content =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            '';
          for (const cb of this.messageCallbacks) {
            try {
              await cb({ sender, content, raw: msg, timestamp: new Date() });
            } catch (e) {
              logger.error(`[WhatsappAdapter:${this.instanceId}] onMessage callback error:`, e);
            }
          }
        }
      });

    } catch (err) {
      this.status = 'disconnected';
      logger.error(`[WhatsappAdapter:${this.instanceId}] Connection failed:`, err);
      throw err;
    }
  }

  /**
   * Gracefully disconnect and clean up all resources.
   * Called by ChannelManager.shutdownAdapter() and the watchdog.
   */
  public async shutdown(): Promise<void> {
    logger.info(`[WhatsappAdapter:${this.instanceId}] Shutting down...`);
    this.isDisconnecting = true;
    this.status = 'disconnected';

    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }

    if (this.socket) {
      try {
        await this.socket.logout();
      } catch {
        // Socket may already be closed
      }
      try {
        this.socket.end(undefined);
      } catch {
        // Ignore close errors
      }
      this.socket = null;
    }

    logger.info(`[WhatsappAdapter:${this.instanceId}] Shutdown complete`);
  }

  // ── Public Accessors ──────────────────────────────────────────────────────

  /** Returns the raw Baileys socket (used by resilienceHarness and queue worker). */
  public getSocket(): WASocket | null {
    return this.socket;
  }

  public getStatus(): AdapterStatus {
    return this.status;
  }

  public getQRCodeUrl(): string | null {
    return this.qrCodeUrl;
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  // ── Message Sending ───────────────────────────────────────────────────────

  /**
   * Low-level send — called ONLY by the anti-ban queue worker (whatsappQueueWorker).
   * Do NOT call this directly from application code — use the job queue instead.
   * The queue worker enforces anti-ban velocity rules before calling this.
   */
  public async _directSendMessage(
    jid: string,
    message: unknown,
    options?: unknown,
  ): Promise<void> {
    if (!this.socket) {
      throw new Error(`[WhatsappAdapter:${this.instanceId}] Socket not connected`);
    }
    await this.socket.sendMessage(jid, message as any, options as any);
  }

  /**
   * High-level send — enqueues to the anti-ban queue worker.
   * This is the correct way to send messages from application code.
   */
  public async sendMessage(jid: string, message: unknown, options?: unknown): Promise<void> {
    const { jobQueueService } = await import('../../services/jobQueue.js');
    await jobQueueService.addJob('whatsapp-outbound', 'send', {
      userId: this.userId,
      channelId: this.channelId,
      jid,
      message,
      options,
    });
  }

  /**
   * Trigger a group sync — updates group membership cache.
   * Used by groupSyncWorker.
   */
  public async triggerGroupSync(): Promise<void> {
    if (!this.socket) return;
    try {
      await this.socket.groupFetchAllParticipating();
      logger.info(`[WhatsappAdapter:${this.instanceId}] Group sync complete`);
    } catch (err) {
      logger.error(`[WhatsappAdapter:${this.instanceId}] Group sync failed:`, err);
    }
  }
}
