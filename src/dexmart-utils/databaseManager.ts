import { db } from '../lib/firebase.js';
import logger from './logger.js';

export class DatabaseManager {
  private static instance: DatabaseManager;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Health check for Firestore
   */
  async healthCheck() {
    try {
      // Try to list a small collection or just check connectivity
      await db.collection('tenants').limit(1).get();
      return {
        connected: true,
        type: 'firestore',
        latency: 0 // Could measure if needed
      };
    } catch (error: any) {
      logger.error('Firestore health check failed:', error);
      return {
        connected: false,
        type: 'firestore',
        error: error.message
      };
    }
  }

  /**
   * For compatibility with legacy code expecting Prisma client
   */
  getClient() {
    return {
      $disconnect: async () => {
        // No-op for Firestore admin SDK in this context
      }
    };
  }
}

export default DatabaseManager.getInstance();
