/**
 * Chat History Manager with Size Limits and Intelligent Summarization
 * Prevents infinite growth while maintaining context.
 * Refactored for Multi-Tenancy (Rule 3).
 */

import { MemoryManager } from './memoryManager.js';
import { db } from '../lib/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { logger } from './logger.js';

export class ChatHistoryManager {
  maxHistoryLength: number;
  maxSummaryLength: number;
  compressionThreshold: number;
  memoryManager: MemoryManager;

  constructor(options: any = {}) {
    this.maxHistoryLength = options.maxHistoryLength || 50;
    this.maxSummaryLength = options.maxSummaryLength || 1000;
    this.compressionThreshold = options.compressionThreshold || 30;
    this.memoryManager = new MemoryManager({
      maxSize: options.maxUsers || 10000,
      ttl: options.userTTL || 7200000 // 2 hours
    });
  }

  private getCacheKey(tenantId: string, userId: string) {
    return `${tenantId}:${userId}`;
  }

  async getChat(tenantId: string, userId: string) {
    const key = this.getCacheKey(tenantId, userId);
    let chat = this.memoryManager.get(key);

    if (!chat) {
      // Load from database if not in memory
      chat = await this.loadFromDatabase(tenantId, userId);
      if (!chat) {
        chat = { history: [], summary: '', lastActivity: Date.now() };
      }
      this.memoryManager.set(key, chat);
    }

    return chat;
  }

  async addMessage(tenantId: string, userId: string, role: string, content: string) {
    const chat = await this.getChat(tenantId, userId);

    // Add new message
    chat.history.push({
      role,
      content,
      timestamp: Date.now()
    });

    // Update last activity
    chat.lastActivity = Date.now();

    // Check if we need to compress history
    if (chat.history.length > this.maxHistoryLength) {
      await this.compressHistory(chat);
    }

    // Save back to memory
    const key = this.getCacheKey(tenantId, userId);
    this.memoryManager.set(key, chat);

    // Async save to database (don't wait)
    this.saveToDatabase(tenantId, userId, chat).catch(err => logger.error('Async save history failed', { tenantId, userId, error: err }));

    return chat;
  }

  /**
   * Directly update chat state (useful for replacing history)
   */
  async updateChat(tenantId: string, userId: string, updates: { history?: any[], summary?: string }) {
    const chat = await this.getChat(tenantId, userId);
    if (updates.history) chat.history = updates.history;
    if (updates.summary !== undefined) chat.summary = updates.summary;
    chat.lastActivity = Date.now();

    const key = this.getCacheKey(tenantId, userId);
    this.memoryManager.set(key, chat);
    await this.saveToDatabase(tenantId, userId, chat);
    return chat;
  }

  async compressHistory(chat: any) {
    // Keep recent messages and summarize older ones
    const recentMessages = chat.history.slice(-this.compressionThreshold);
    const oldMessages = chat.history.slice(0, -this.compressionThreshold);

    if (oldMessages.length > 0) {
      // Create summary of old messages
      const oldSummary = await this.summarizeMessages(oldMessages);

      // Combine with existing summary
      if (chat.summary) {
        chat.summary = await this.combineSummaries(chat.summary, oldSummary);
      } else {
        chat.summary = oldSummary;
      }

      // Trim summary if too long
      if (chat.summary.length > this.maxSummaryLength) {
        chat.summary = chat.summary.substring(0, this.maxSummaryLength) + '...';
      }
    }

    // Keep only recent messages
    chat.history = recentMessages;
  }

  async summarizeMessages(messages: any[]) {
    // Simplified summarization
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    return `Previous context: ${userMessages} user messages and ${assistantMessages} assistant responses.`;
  }

  async combineSummaries(oldSummary: string, newSummary: string) {
    return `${oldSummary} | ${newSummary}`;
  }

  async loadFromDatabase(tenantId: string, userId: string) {
    try {
      const doc = await db.collection('tenants').doc(tenantId).collection('conversation_memory').doc(userId).get();

      if (!doc.exists) return null;

      const record = doc.data()!;
      let history = [];
      try {
        history = typeof record.messages === 'string' ? JSON.parse(record.messages) : record.messages;
      } catch (_) {
        history = [];
      }
      return {
        history,
        summary: record.summary || '',
        lastActivity: record.lastUpdated ? (record.lastUpdated instanceof Timestamp ? record.lastUpdated.toMillis() : Date.now()) : Date.now()
      };
    } catch (error: any) {
      logger.error('Error loading chat from database:', { tenantId, userId, error });
      return null;
    }
  }

  async saveToDatabase(tenantId: string, userId: string, chat: any) {
    try {
      const messagesJson = JSON.stringify(chat.history);
      const data = {
        userId,
        messages: messagesJson,
        summary: chat.summary,
        lastUpdated: Timestamp.now()
      };

      await db.collection('tenants').doc(tenantId).collection('conversation_memory').doc(userId).set(data, { merge: true });
    } catch (error: any) {
      logger.error('Error saving chat to database:', { tenantId, userId, error });
    }
  }

  // Get statistics
  getStats() {
    const memStats = this.memoryManager.getStats();
    return {
      activeChats: memStats.size,
      memoryUsage: memStats.memoryUsage,
      maxHistoryLength: this.maxHistoryLength,
      compressionThreshold: this.compressionThreshold
    };
  }

  // Cleanup inactive users for a specific tenant
  async cleanupInactiveUsers(tenantId: string, inactivityThreshold = 24 * 60 * 60 * 1000) {
    const cutoff = Timestamp.fromMillis(Date.now() - inactivityThreshold);
    try {
      const snapshot = await db.collection('tenants').doc(tenantId).collection('conversation_memory').where('lastUpdated', '<', cutoff).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (e) {
      logger.error('Cleanup failed', { tenantId, error: e });
    }
  }
}

export const chatHistoryManager = new ChatHistoryManager();
export default chatHistoryManager;