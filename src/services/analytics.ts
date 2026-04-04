
import { WebSocket, WebSocketServer } from 'ws';
import logger from '../utils/logger.js';
import { db, admin } from '../lib/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { firebaseService } from './FirebaseService.js';
import { Result, AnalyticsData } from '../types/contracts.js';

interface AnalyticsMetrics {
  activeUsers: number;
  totalCommands: number;
  aiRequests: number;
  responseTime: number;
  errorRate: number;
  uptime: number;
  timestamp?: string;
  errorsPerMinute?: number;
}

class AnalyticsService {
  private wss: WebSocketServer | null;
  private clients: Map<string, Set<WebSocket>>; // Grouped by tenantId
  private isInitialized: boolean;
  private cache: Map<string, { data: any; timestamp: number }>;
  private metrics: Map<string, AnalyticsMetrics>; // Per tenant

  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.isInitialized = false;
    this.cache = new Map();
    this.metrics = new Map();
    logger.info('Analytics service initialized');
  }

  async initialize(config: { websocketPort?: number }) {
    try {
      if (config.websocketPort) {
        this.wss = new WebSocketServer({ port: config.websocketPort });
        this.wss.on('connection', async (ws: WebSocket, req) => {
          // Identify tenant from URL or header (e.g., /?tenantId=XXX)
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const tenantId = url.searchParams.get('tenantId');

          if (!tenantId) {
            ws.close(1008, 'Tenant ID Required');
            return;
          }

          if (!this.clients.has(tenantId)) this.clients.set(tenantId, new Set());
          this.clients.get(tenantId)!.add(ws);

          ws.on('close', () => {
            this.clients.get(tenantId)?.delete(ws);
            if (this.clients.get(tenantId)?.size === 0) this.clients.delete(tenantId);
          });

          const dashResult = await this.getDashboardData(tenantId);
          if (dashResult.success) {
            this.sendToClient(ws, { type: 'welcome', data: dashResult.data });
          }
        });
        logger.info(`WebSocket server started on port ${config.websocketPort}`);
      }
      this.startMetricsCollection();
      this.isInitialized = true;
    } catch (error: any) {
      logger.error('Failed to initialize analytics service', error);
      throw error;
    }
  }

  async broadcastToTenant(tenantId: string, data: any) {
    const message = JSON.stringify(data);
    this.clients.get(tenantId)?.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
    });
  }

  startMetricsCollection() {
    setInterval(async () => {
      // Collect metrics for active tenants
      for (const tenantId of this.clients.keys()) {
        try {
          await this.updateTenantMetrics(tenantId);
          const dashResult = await this.getDashboardData(tenantId);
          if (dashResult.success) {
            this.broadcastToTenant(tenantId, { type: 'dashboard_update', data: dashResult.data });
          }
        } catch (e) { logger.error(`Metrics failed for ${tenantId}`, e); }
      }
    }, 30000);
  }

  async updateTenantMetrics(tenantId: string) {
    const oneDayAgo = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const tenantPath = `tenants/${tenantId}`;

    // Workspace-isolated queries
    const commandCount = (await db.collection(`${tenantPath}/command_usage`).where('usedAt', '>=', oneDayAgo).count().get()).data().count;
    const aiCount = (await db.collection(`${tenantPath}/command_usage`).where('category', '==', 'ai-chat').count().get()).data().count;
    const errorCount = (await db.collection(`${tenantPath}/command_usage`).where('success', '==', false).count().get()).data().count;

    this.metrics.set(tenantId, {
      activeUsers: 0, // Implement per-tenant activity tracking in next step
      totalCommands: commandCount,
      aiRequests: aiCount,
      responseTime: 0,
      errorRate: commandCount > 0 ? (errorCount / commandCount) * 100 : 0,
      uptime: process.uptime(),
    });
  }

  async getDashboardData(tenantId: string): Promise<Result<any>> {
    try {
      const tenantMetrics = this.metrics.get(tenantId);
      const tenantPath = `tenants/${tenantId}`;

      // Recent Activity for this tenant only
      const recentSnapshot = await db.collection(`${tenantPath}/command_usage`).orderBy('usedAt', 'desc').limit(10).get();
      const recentActivity = recentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data().usedAt as Timestamp).toDate()
      }));

      return {
        success: true,
        data: {
          overview: { ...tenantMetrics },
          recentActivity,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Track daily message statistics
   */
  async trackMessage(tenantId: string, type: 'sent' | 'received' | 'error'): Promise<Result<void>> {
    try {
      const date = new Date().toISOString().split('T')[0];
      const field = type === 'sent' ? 'sent' : type === 'received' ? 'received' : 'errors';

      // 1. Daily Analytics Roll-up (for charts)
      await firebaseService.setDoc<'tenants/{tenantId}/analytics'>(
        'analytics',
        date,
        {
          date,
          [field]: admin.firestore.FieldValue.increment(1),
          updatedAt: new Date()
        },
        tenantId,
        true
      );

      // 2. Real-time Tenant Limit Enforcement
      if (type === 'sent' || type === 'received') {
        const tenantField = type === 'sent' ? 'totalMessagesSent' : 'totalMessagesReceived';
        await db.doc(`tenants/${tenantId}`).update({
          [`stats.${tenantField}`]: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return { success: true, data: undefined };
    } catch (error: any) {
      logger.error('Failed to track message', error);
      return { success: false, error };
    }
  }

  async getHistoricalMetrics(tenantId: string, days = 7): Promise<Result<AnalyticsData[]>> {
    try {
      const metrics = await firebaseService.getCollection<'tenants/{tenantId}/analytics'>(
        'analytics',
        tenantId
      );
      // Sort and limit in memory for now, or use Firestore queries if supported by getCollection
      const sorted = metrics
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, days);

      return { success: true, data: sorted };
    } catch (error: any) {
      logger.error('Failed to get historical metrics', error);
      return { success: false, error };
    }
  }

  async trackEvent(tenantId: string, userId: string, event: string, properties: any = {}): Promise<Result<void>> {
    try {
      // Use tenant-specific collection for events
      await db.collection(`tenants/${tenantId}/events`).add({
        userId,
        event: `event_${event}`,
        value: 1,
        category: 'behavior',
        properties,
        recordedAt: Timestamp.now()
      });
      return { success: true, data: undefined };
    } catch (error: any) {
      logger.error('Failed to track event', error);
      return { success: false, error };
    }
  }

  private sendToClient(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Legacy wrapper
  async create(data: { data: any }) {
    try {
      await db.collection('analytics_legacy').add({
        ...data.data,
        recordedAt: Timestamp.now()
      });
    } catch (e) { logger.error('Failed to create legacy analytics entry', e); }
  }
}

export default new AnalyticsService();
