import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import logger from '../utils/logger.js';
import { ConfigService } from './ConfigService.js';
import { Result } from '../types/contracts.js';

interface UserPayload {
    userId: string;
    email: string;
    tenantId: string;
    role: string;
    iat: number;
    exp: number;
}

export class SocketService {
    private static instance: SocketService;
    private io: Server | null = null;
    private readonly config: ConfigService;

    private constructor() {
        this.config = ConfigService.getInstance();
    }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public initialize(server: HttpServer): void {
        this.io = new Server(server, {
            cors: {
                origin: (origin, callback) => {
                    const allowedOrigin = this.config.get('NEXT_PUBLIC_APP_URL');
                    // In 2026, we allow local development and the configured app URL
                    if (!origin || 
                        origin === 'http://localhost:3000' || 
                        origin === 'http://127.0.0.1:3000' ||
                        origin === allowedOrigin ||
                        origin.includes('localhost')) {
                        callback(null, true);
                    } else {
                        logger.warn(`[Socket] CORS blocked for origin: ${origin}`);
                        callback(new Error('Not allowed by CORS'));
                    }
                },
                methods: ['GET', 'POST'],
                credentials: true
            },
            path: '/api/socket',
            addTrailingSlash: false // STRICT: Prevent /api/socket/ vs /api/socket mismatch
        });

        // Authentication Middleware
        this.io.use((socket: Socket, next) => {
            try {
                let token = socket.handshake.auth.token || socket.handshake.query.token;

                if (!token && socket.handshake.headers.cookie) {
                    const cookies = cookie.parse(socket.handshake.headers.cookie);
                    token = cookies.token;
                }

                if (!token) {
                    return next(new Error('Authentication error: Token missing'));
                }

                const secret = this.config.get('JWT_SECRET');
                const decoded = jwt.verify(token, secret) as UserPayload;

                (socket as any).user = decoded;
                next();
            } catch (error) {
                logger.security('Socket Auth: Connection failed', null, { error: (error as Error).message });
                next(new Error('Authentication error: Invalid token'));
            }
        });

        this.io.on('connection', (socket: Socket) => {
            const user = (socket as any).user as UserPayload;
            const roomName = `tenants:${user.tenantId}`;

            socket.join(roomName);
            logger.info(`Socket connected: ${socket.id} joined room ${roomName}`);

            socket.on('disconnect', () => {
                logger.info(`Socket disconnected: ${socket.id}`);
            });
        });

        logger.info('Unified Socket Service initialized');
    }

    /**
     * Emit generic event to a specific tenant room
     */
    public emitToTenant<T>(tenantId: string, event: string, data: T): Result<void> {
        if (!this.io) {
            return { success: false, error: new Error('Socket.io not initialized') };
        }

        try {
            const roomName = `tenants:${tenantId}`;
            this.io.to(roomName).emit(event, {
                ...(data as any),
                timestamp: new Date().toISOString()
            });
            return { success: true, data: undefined };
        } catch (error) {
            logger.error(`Failed to emit socket event: ${event}`, {
                error: (error as Error).message,
                tenantId
            });
            return { success: false, error: error as Error };
        }
    }

    /**
     * Emit granular channel connection progress
     */
    public emitChannelProgress(tenantId: string, channelId: string, step: string, status: 'pending' | 'in_progress' | 'complete' | 'error'): Result<void> {
        return this.emitToTenant(tenantId, 'channel_progress_update', { channelId, step, status });
    }

    /**
     * Emit channel lifecycle status change
     */
    public emitChannelStatus(tenantId: string, channelId: string, status: string): Result<void> {
        return this.emitToTenant(tenantId, 'channel_status_update', { channelId, status });
    }

    /**
     * Emit QR Code update
     */
    public emitQRCode(tenantId: string, channelId: string, qrCode: string): Result<void> {
        return this.emitToTenant(tenantId, 'channel_qr_update', { channelId, qrCode });
    }

    /**
     * Emit channel activity event (message received, skill triggered, etc.)
     */
    public emitActivity(tenantId: string, channelId: string, platform: string, type: string, message: string, metadata?: any): Result<void> {
        return this.emitToTenant(tenantId, 'activity_event', { channelId, platform, type, message, metadata });
    }

    /**
     * Legacy helper for campaign progress
     * @deprecated Use emitToTenant directly with 'campaign_update' event
     */
    public emitProgress(tenantId: string, campaignId: string, stats: any): Result<void> {
        return this.emitToTenant(tenantId, 'campaign_update', { campaignId, stats });
    }
}

export const socketService = SocketService.getInstance();
