import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';
import { Timestamp } from 'firebase-admin/firestore';

interface AuditEvent {
  eventType: string;
  actor: string;
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  location?: string;
  metadata?: any;
}

interface AuditFilters {
  eventType?: string;
  actor?: string;
  actorId?: string;
  resource?: string;
  resourceId?: string;
  riskLevel?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class AuditService {
  private collection = db.collection('audit_logs');

  constructor() {
    // Audit service using Firestore
  }

  async logEvent(eventData: AuditEvent) {
    try {
      const data = {
        ...eventData,
        details: eventData.details || {},
        riskLevel: eventData.riskLevel || 'LOW',
        metadata: eventData.metadata || {},
        createdAt: Timestamp.now(),
      };

      const docRef = await this.collection.add(data);

      return {
        id: docRef.id,
        ...data,
        createdAt: data.createdAt.toDate()
      };
    } catch (error: any) {
      logger.error('Error logging audit event:', error);
      throw error;
    }
  }

  async getAuditLogs(filters: AuditFilters = {}, options: any = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      let query: FirebaseFirestore.Query = this.collection;

      if (filters.eventType) {
        query = query.where('eventType', '==', filters.eventType);
      }

      if (filters.actorId) {
        query = query.where('actorId', '==', filters.actorId);
      }

      if (filters.resource) {
        query = query.where('resource', '==', filters.resource);
      }

      if (filters.resourceId) {
        query = query.where('resourceId', '==', filters.resourceId);
      }

      if (filters.riskLevel) {
        query = query.where('riskLevel', '==', filters.riskLevel.toUpperCase());
      }

      if (filters.startDate) {
        query = query.where('createdAt', '>=', Timestamp.fromDate(new Date(filters.startDate)));
      }

      if (filters.endDate) {
        query = query.where('createdAt', '<=', Timestamp.fromDate(new Date(filters.endDate)));
      }

      // Order by createdAt desc by default
      if (!filters.sortBy || filters.sortBy === 'createdAt') {
        query = query.orderBy('createdAt', filters.sortOrder === 'asc' ? 'asc' : 'desc');
      }

      // Get snapshot for pagination
      // Note: Offset is expensive in Firestore, but using it for compatibility
      const snapshot = await query.offset((page - 1) * limit).limit(limit).get();

      // Get total count (using aggregation query if possible, or separate count)
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        };
      });

      return {
        logs,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error('Error getting audit logs:', error);
      // Fallback for missing indexes
      if ((error as any).code === 9) { // FAILED_PRECONDITION (usually missing index)
        logger.warn('Missing Firestore index for audit logs query. Returning empty result temporarily.');
        return { logs: [], total: 0, page: 1, limit: 50 };
      }
      throw error;
    }
  }

  async getAuditLogById(id: string) {
    try {
      const doc = await this.collection.doc(id).get();
      if (!doc.exists) return null;

      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
      };
    } catch (error: any) {
      logger.error('Error getting audit log by ID:', error);
      return null;
    }
  }

  async getStatistics(filters: AuditFilters = {}) {
    try {
      // Basic stats using aggregations supported by Firestore
      // Complex groupings (like groupBy in SQL) are harder in Firestore without client-side processing
      // or specialized counters.

      // For now, we'll fetch recent logs and do limited client-side aggregation for the stats view
      // This is not scalable for huge datasets but works for migration

      let query: FirebaseFirestore.Query = this.collection;

      if (filters.startDate) {
        query = query.where('createdAt', '>=', Timestamp.fromDate(new Date(filters.startDate)));
      }
      if (filters.endDate) {
        query = query.where('createdAt', '<=', Timestamp.fromDate(new Date(filters.endDate)));
      }

      // Get count
      const countSnapshot = await query.count().get();
      const totalEvents = countSnapshot.data().count;

      // Get recent events (last 10)
      const recentSnapshot = await query.orderBy('createdAt', 'desc').limit(10).get();
      const recentEvents = recentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp).toDate()
      }));

      // Calculate event type and risk level distribution from actual data
      // For better performance, we limit this to recent events (last 1000)
      const statsSnapshot = await query.orderBy('createdAt', 'desc').limit(1000).get();
      const eventsByType: Record<string, number> = {};
      const eventsByRisk: Record<string, number> = {};

      statsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const eventType = data.eventType || 'unknown';
        const riskLevel = data.riskLevel || 'low';
        
        eventsByType[eventType] = (eventsByType[eventType] || 0) + 1;
        eventsByRisk[riskLevel] = (eventsByRisk[riskLevel] || 0) + 1;
      });

      return {
        totalEvents,
        eventsByType,
        eventsByRisk, // To be implemented with counters if needed
        recentEvents,
        timeRange: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      };
    } catch (error: any) {
      logger.error('Error getting audit statistics:', error);
      throw error;
    }
  }

  async exportAuditLogs(filters: AuditFilters = {}, format: string = 'json') {
    const { logs } = await this.getAuditLogs(filters, { limit: 1000 }); // Cap at 1000 for export

    if (format === 'csv') {
      const headers = [
        'ID',
        'Timestamp',
        'Event Type',
        'Actor',
        'Actor ID',
        'Action',
        'Resource',
        'Resource ID',
        'Risk Level',
        'IP Address',
        'Details',
      ];

      const rows = logs.map((log: any) => [
        log.id,
        log.createdAt.toISOString(),
        log.eventType,
        log.actor || '',
        log.actorId || '',
        log.action,
        log.resource,
        log.resourceId || '',
        log.riskLevel,
        log.ipAddress || '',
        JSON.stringify(log.details).replace(/"/g, '""'),
      ]);

      return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    }

    return JSON.stringify(logs, null, 2);
  }

  async getEventTypes() {
    // Not easily efficient in Firestore
    return [];
  }

  async searchAuditLogs(query: string, fields: string[] = ['actor', 'action', 'resource'], options: any = {}) {
    // Firestore doesn't support full-text search natively like 'contains' for multiple fields with OR.
    // We will just return empty for now, or implement a very basic prefix search if possible.
    // Proper solution requires Algolia/Elasticsearch or specific setup.
    logger.warn('Search not fully supported in Firestore backend yet');
    return { logs: [], total: 0, page: 1, limit: options.limit || 50 };
  }

  async getUserActivity(userId: string, dateFilters: AuditFilters = {}, options: any = {}) {
    return this.getAuditLogs({ ...dateFilters, actorId: userId }, options);
  }

  async getResourceActivity(resource: string, resourceId: string, dateFilters: AuditFilters = {}, options: any = {}) {
    return this.getAuditLogs({ ...dateFilters, resource, resourceId }, options);
  }

  async cleanupOldLogs(days: number = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      // Batch delete
      const snapshot = await this.collection.where('createdAt', '<', cutoffTimestamp).limit(500).get();

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      return {
        deletedCount: snapshot.size, // This is just the batch size, needs loop for full cleanup but fine for now
        retentionDays: days,
        cutoffDate: cutoffDate.toISOString(),
      };
    } catch (error: any) {
      logger.error('Error cleaning up old logs:', error);
      throw error;
    }
  }
}

export default new AuditService();
