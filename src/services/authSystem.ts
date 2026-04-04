import { EventEmitter } from 'events';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { makeWASocket, DisconnectReason, type WASocket, initAuthCreds, Browsers, fetchLatestBaileysVersion } from 'baileys';
import logger from '../utils/logger.js';
import { useFirestoreAuthState } from '../lib/baileysFirestoreAuth.js';
import { Result } from '../types/index.js';
import { AppError } from './errorHandler.js';

interface AuthConfig {
  channel: {
    phoneNumber?: string;
    sessionId?: string;
    deviceName?: string;
    proxyUrl?: string; // Optional HTTP proxy (e.g. http://username:password@ip:port)
  };
}

interface AuthStats {
  totalAttempts: number;
  successes: number;
  methodStats: {
    qr: { attempts: number; successes: number };
    pairing: { attempts: number; successes: number };
  };
  activeSessions: number;
}

class AuthSystem extends EventEmitter {
  private readonly config: AuthConfig;
  private readonly tenantId: string;
  private readonly channelId: string;
  private readonly collectionOrPath: string;
  private authState: 'connected' | 'disconnected' | 'connecting';
  private client: WASocket | null;
  private currentQrCode: string | null;
  private stats: AuthStats;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isDisconnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: AuthConfig, tenantId: string, channelId: string, collectionOrPath: string = 'channels') {
    super();
    this.config = config;
    this.tenantId = tenantId;
    this.channelId = channelId;
    this.collectionOrPath = collectionOrPath;
    this.authState = 'disconnected';
    this.client = null;
    this.currentQrCode = null;

    this.stats = {
      totalAttempts: 0,
      successes: 0,
      methodStats: {
        qr: { attempts: 0, successes: 0 },
        pairing: { attempts: 0, successes: 0 },
      },
      activeSessions: 0,
    };

    logger.info(`AuthSystem initialized for Channel: ${channelId} (Tenant: ${tenantId}, Path: ${collectionOrPath})`);
  }

  public updatePath(newCollectionOrPath: string): void {
    logger.info(`[AuthSystem] Path updated for ${this.channelId}: ${this.collectionOrPath} -> ${newCollectionOrPath}`);
    (this as any).collectionOrPath = newCollectionOrPath;
  }

  async connect(forceNewSession: boolean = false): Promise<Result<WASocket>> {
    this.emit('status', 'initializing');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }

    // Scenario 7: Handshake hang protection (30s)
    this.connectTimeout = setTimeout(() => {
      if (this.authState === 'connecting') {
        logger.warn(`[AuthSystem] Connection handshake timed out for ${this.channelId}. Killing socket.`);
        if (this.client) {
          try { this.client.end(undefined); } catch (e) { }
          this.client = null;
        }
        this.authState = 'disconnected';
        this.emit('disconnected', new Error('Handshake Timeout'));
      }
    }, 30 * 1000);

    this.authState = 'connecting';
    this.emit('status', 'connecting');
    const method = this.config.channel.phoneNumber ? 'pairing' : 'qr';
    this._recordAttempt(method);

    logger.info(`[AuthSystem] Starting connection attempt for ${this.channelId}. Force: ${forceNewSession}`);

    try {
      // Fix: Correctly pass tenantId, channelId and collectionOrPath to the auth adapter
      const { state, saveCreds } = await useFirestoreAuthState(this.tenantId, this.channelId, this.collectionOrPath);

      if (forceNewSession) {
        logger.warn(`[AuthSystem] FORCING new session for ${this.channelId}. Clearing old creds.`);
        state.creds = initAuthCreds();
        this.currentQrCode = null;
      }

      logger.info(`[AuthSystem] Auth state loaded for ${this.channelId}. Has Me: ${!!state.creds.me}`);

      const pinoLogger = pino({ level: 'silent' });

      const { version, isLatest } = await fetchLatestBaileysVersion();
      if (!isLatest) {
        logger.warn(`[AuthSystem] A newer version of Baileys is available: ${version.join('.')}. Current session might need update.`);
      }

      // Setup proxy if configured (Phase 4 Anti-Ban Engine integration)
      let customAgent;
      if (this.config.channel.proxyUrl) {
        logger.info(`[AuthSystem] Applying custom proxy IP for ${this.channelId}`);
        // Dynamic import to avoid overhead if not used
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        customAgent = new HttpsProxyAgent(this.config.channel.proxyUrl);
      }

      this.client = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pinoLogger as any,
        browser: [this.config.channel.deviceName || 'DeXMart', 'Desktop', '1.0.0'],
        agent: customAgent,
        // Phase 3: Resource Optimization - Ignore history for non-essential JIDs
        shouldIgnoreJid: (jid) => jid.endsWith('@broadcast') || jid.endsWith('@newsletter'),
        // Prevent storing full history in memory to avoid bloat
        getMessage: async (key) => {
          return undefined; // We don't need to return old messages from memory
        }
      });

      this.client.ev.on('creds.update', saveCreds);

      this.client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          if (this.connectTimeout) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
          }
          logger.info(`[AuthSystem] QR RECEIVED for ${this.channelId}. Length: ${qr.length}`);
          this.currentQrCode = qr;
          this.emit('qr', qr);
          this.emit('status', 'qr_pending'); // Inform status change
          this.stats.methodStats.qr.attempts++;
        }

        if (connection === 'close') {
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }
          this.authState = 'disconnected';
          this.stats.activeSessions = 0;

          const error = lastDisconnect?.error;
          const statusCode = (error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isForbidden = statusCode === 403; // Forbidden often indicates a Ban (Scenario 51)
          const shouldReconnect = !isLoggedOut && !isForbidden;

          logger.warn(`[AuthSystem] Connection closed for ${this.channelId}. Reconnect: ${shouldReconnect}`, { error, statusCode });

          if (isLoggedOut || isForbidden) {
            const status = isForbidden ? 'banned' : 'logged_out';
            logger.error(`[AuthSystem] SESSION ${status.toUpperCase()} for ${this.channelId}. Cleaning up Firestore auth state...`);
            // Emit status BEFORE the async cleanup so it always fires even if clearAuthState throws
            this.currentQrCode = null;
            this.emit('status', status);
            // Best-effort: clean up stored credentials. Failure here is non-fatal.
            try {
              const { clearAuthState } = await useFirestoreAuthState(this.tenantId, this.channelId, this.collectionOrPath);
              await clearAuthState();
            } catch (err) {
              logger.error(`[AuthSystem] Failed to clear auth state during ${status}:`, err);
            }
          }

          this.emit('disconnected', error);

          if (shouldReconnect) {
            this.reconnectAttempts++;
            if (this.reconnectAttempts > this.maxReconnectAttempts) {
              logger.error(`[AuthSystem] Max reconnect attempts (${this.maxReconnectAttempts}) reached for ${this.channelId}. Giving up.`);
              this.emit('status', 'reconnect_exhausted');
              return;
            }
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 1 minute
            const delay = Math.min(Math.pow(2, this.reconnectAttempts - 1) * 1000, 60 * 1000);
            logger.info(`[AuthSystem] Scheduling reconnect in ${delay}ms (Attempt ${this.reconnectAttempts})`);

            this.reconnectTimer = setTimeout(() => {
              this.connect();
            }, delay);
          }
        } else if (connection === 'open') {
          if (this.connectTimeout) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
          }
          logger.info(`[AuthSystem] CONNECTION OPEN for ${this.channelId}`);
          this.authState = 'connected';
          this.reconnectAttempts = 0; // Reset backoff on success
          this.stats.activeSessions = 1;
          this.stats.successes++;
          this.emit('connected');
          this.emit('status', 'connected');

          // Scenario 15: Heartbeat to prevent sleep/battery kill
          if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = setInterval(async () => {
            try {
              if (this.client && this.authState === 'connected') {
                await this.client.sendPresenceUpdate('available');
              }
            } catch (e) {
              logger.warn(`[AuthSystem] Heartbeat failed for ${this.channelId}`, e);
            }
          }, 30 * 1000); // 30 seconds
        }
      });

      return { success: true, data: this.client };

    } catch (error: unknown) {
      this.authState = 'disconnected';
      const appError = error instanceof Error ? error : new Error('Unknown connection error');
      logger.error('AuthSystem connection failed', { error: appError });
      return { success: false, error: appError };
    }
  }

  async disconnect(): Promise<Result<void>> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.client) {
      try {
        this.client.end(undefined); // Correct way to close baileys socket
        this.client = null;
        this.authState = 'disconnected';
        this.stats.activeSessions = 0;
        return { success: true, data: undefined };
      } catch (error: any) {
        return { success: false, error };
      }
    }
    return { success: true, data: undefined };
  }

  async getPairingCode(phoneNumber: string): Promise<Result<string>> {
    if (!this.client) {
      return { success: false, error: new AppError('Baileys client not initialized. Call connect() first.') };
    }
    if (!phoneNumber) {
      return { success: false, error: new AppError('Phone number is required for pairing code.') };
    }

    try {
      const formattedPhoneNumber = phoneNumber.replace(/\D/g, '');
      this._recordAttempt('pairing');

      const code = await this.client.requestPairingCode(formattedPhoneNumber);
      logger.info(`Requested Pairing Code: ${code}`);

      return { success: true, data: code };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error : new Error('Failed to get pairing code') };
    }
  }

  async getQRCode(): Promise<Result<string | null>> {
    if (!this.client) {
      return { success: false, error: new AppError('Baileys client not initialized.') };
    }
    return { success: true, data: this.currentQrCode };
  }



  async detectExistingSession(): Promise<{ hasSession: boolean; isValid: boolean }> {
    try {
      const { state } = await useFirestoreAuthState(this.tenantId, this.channelId, this.collectionOrPath);
      // Check if we have a registration ID and 'me' object which indicates a successful login
      const hasSession = !!(state.creds && state.creds.registrationId);
      const isValid = !!(state.creds && state.creds.me);
      return { hasSession, isValid };
    } catch (error) {
      logger.error('Error detecting existing session', { error });
      return { hasSession: false, isValid: false };
    }
  }

  getAnalytics() {
    const successRate = this.stats.totalAttempts > 0
      ? `${Math.round((this.stats.successes / this.stats.totalAttempts) * 100)}%`
      : '0%';

    return {
      activeSessions: this.stats.activeSessions,
      stats: {
        ...this.stats,
        successRate
      }
    };
  }

  async getSmartAuthMethod(config: any): Promise<{ method: 'qr' | 'pairing'; confidence: number }> {
    // Logic to determine best auth method
    if (config?.channel?.phoneNumber || this.config.channel.phoneNumber) {
      return { method: 'pairing', confidence: 1.0 };
    }
    return { method: 'qr', confidence: 0.9 };
  }

  get authStrategies() {
    return {
      qr: async (config: any) => {
        return await this.connect();
      },
      pairing: async (config: any) => {
        const conn = await this.connect();
        if (conn.success && conn.data) {
          const phoneNumber = config?.channel?.phoneNumber || this.config.channel.phoneNumber;
          if (phoneNumber) {
            const code = await this.getPairingCode(phoneNumber);
            return { ...conn, pairingCode: code.success ? code.data : null };
          }
        }
        return conn;
      }
    };
  }

  private _recordAttempt(method: 'qr' | 'pairing') {
    this.stats.totalAttempts++;
    if (this.stats.methodStats[method]) {
      this.stats.methodStats[method].attempts++;
    }
  }
}

export default AuthSystem;
