import { db } from '../lib/firebase.js';
import { embeddingService } from './embeddingService.js';
import { treeIndexService, TreeNode } from './TreeIndexService.js';
import { semanticCacheService } from './SemanticCacheService.js';
import { Timestamp } from 'firebase-admin/firestore';
import logger from '../utils/logger.js';
import { Result } from '../types/index.js';

interface ConversationEmbedding {
  userId: string;
  scopeId: string; // channelId:chatId
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  timestamp: Timestamp;
}

interface ConversationContext {
  content: string;
  timestamp: Date;
  similarity: number;
  metadata: Record<string, any>;
  source?: 'vector' | 'tree' | 'cache';
}

export class MemoryService {
  private static instance: MemoryService;
  private similarityThreshold: number;
  private maxContexts: number;

  private constructor() {
    this.similarityThreshold = 0.75;
    this.maxContexts = 5;
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  /**
   * Store a conversation snippet with its vector embedding
   * Now also indexes into the Tree Structure (Phase 1)
   */
  async storeConversation(userId: string, conversationText: string, metadata: Record<string, any> = {}): Promise<Result<void>> {
    try {
      const embeddingResult = await embeddingService.generateEmbedding(conversationText);
      if (!embeddingResult.success || !embeddingResult.data) {
        throw new Error('Failed to generate embedding');
      }

      const platform = metadata.platform || 'unknown';
      const chatId = metadata.chatId || userId;
      const scopeId = `${platform}:${chatId}`;

      // 1. Store Flat Vector (Legacy/Fallback)
      await db.collection('conversation_embeddings').add({
        userId,
        scopeId,
        content: conversationText,
        embedding: embeddingResult.data,
        metadata,
        timestamp: Timestamp.now()
      });

      // 2. Store Tree Node (Phase 1)
      // If we have a parentId in metadata, add as child. Otherwise, root.
      if (metadata.parentId) {
        await treeIndexService.addChild(scopeId, metadata.parentId, conversationText, metadata);
      } else {
        await treeIndexService.createRoot(scopeId, conversationText, metadata);
      }

      logger.info(`Stored conversation embedding for user ${userId} [Scope: ${scopeId}]`);
      return { success: true, data: undefined };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error storing conversation embedding:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Retrieve relevant historical contexts scoped by channel/chat
   * Uses Semantic Cache -> Tree Search -> Flat Vector Search
   */
  async retrieveRelevantContext(userId: string, newText: string, scope?: { platform: string, chatId: string }): Promise<Result<ConversationContext[]>> {
    try {
      // 1. Check Semantic Cache (Phase 2)
      const cacheResult = await semanticCacheService.retrieve(newText);
      if (cacheResult.success && cacheResult.data) {
        logger.info(`[MemoryService] Semantic cache hit for query: "${newText}"`);
        return { success: true, data: cacheResult.data }; // Assumes cache stores ConversationContext[]
      }

      const scopeId = scope ? `${scope.platform}:${scope.chatId}` : undefined;

      // 2. Try Tree Search (Phase 1)
      if (scopeId) {
        const treeResults = await treeIndexService.searchTree(scopeId, newText, this.similarityThreshold);
        if (treeResults.success && treeResults.data && treeResults.data.length > 0) {
          logger.info(`[MemoryService] Tree Search found ${treeResults.data.length} results`);
          const contexts = treeResults.data.map(node => ({
            content: node.content, // Return full content, not summary
            timestamp: node.createdAt.toDate(),
            similarity: 0.9, // Tree match implies high relevance
            metadata: { ...node.metadata, nodeId: node.id },
            source: 'tree' as const
          }));
          
          // Cache this result for future
          await semanticCacheService.cacheResult(newText, contexts);
          return { success: true, data: contexts };
        }
      }

      // 3. Fallback to Flat Vector Search
      const queryEmbeddingResult = await embeddingService.generateEmbedding(newText);
      if (!queryEmbeddingResult.success || !queryEmbeddingResult.data) {
        throw new Error('Failed to generate query embedding');
      }
      const queryEmbedding = queryEmbeddingResult.data;

      let query: any = db.collection('conversation_embeddings');
      
      if (scopeId) {
        query = query.where('scopeId', '==', scopeId);
      } else {
        query = query.where('userId', '==', userId);
      }

      const snapshot = await query
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      if (snapshot.empty) return { success: true, data: [] };

      const results = snapshot.docs.map((doc: any) => {
        const data = doc.data() as ConversationEmbedding;
        const similarity = this.cosineSimilarity(queryEmbedding, data.embedding);
        return {
          content: data.content,
          timestamp: data.timestamp.toDate(),
          similarity,
          metadata: data.metadata,
          source: 'vector' as const
        };
      });

      const filtered = results
        .filter((r: any) => r.similarity > this.similarityThreshold)
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, this.maxContexts);

      // Cache the result
      if (filtered.length > 0) {
        await semanticCacheService.cacheResult(newText, filtered);
      }

      return { success: true, data: filtered };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error retrieving context:', err);
      return { success: false, error: err };
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async getConversationStats(userId: string): Promise<Result<{ total: number; first: Date | null; last: Date | null }>> {
    try {
      const coll = db.collection('conversation_embeddings').where('userId', '==', userId);
      const snapshot = await coll.count().get();
      const count = snapshot.data().count;

      const first = await coll.orderBy('timestamp', 'asc').limit(1).get();
      const last = await coll.orderBy('timestamp', 'desc').limit(1).get();

      return {
        success: true,
        data: {
          total: count,
          first: first.empty ? null : (first.docs[0].data().timestamp as Timestamp).toDate(),
          last: last.empty ? null : (last.docs[0].data().timestamp as Timestamp).toDate()
        }
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error getting conversation stats:', err);
      return { success: false, error: err };
    }
  }

  async cleanupOldConversations(daysToKeep = 30): Promise<Result<number>> {
    try {
      const cutoffDate = Timestamp.fromMillis(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      const snapshot = await db.collection('conversation_embeddings')
        .where('timestamp', '<', cutoffDate)
        .get();

      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      logger.info(`Cleaned up old conversations, deleted ${snapshot.size} records`);
      return { success: true, data: snapshot.size };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error cleaning up conversations:', err);
      return { success: false, error: err };
    }
  }

  setSimilarityThreshold(threshold: number): void {
    if (threshold >= 0 && threshold <= 1) {
      this.similarityThreshold = threshold;
      logger.info(`Updated similarity threshold to ${threshold}`);
    } else {
      throw new Error('Similarity threshold must be between 0 and 1');
    }
  }

  setMaxContexts(maxContexts: number): void {
    if (maxContexts > 0) {
      this.maxContexts = maxContexts;
      logger.info(`Updated max contexts to ${maxContexts}`);
    } else {
      throw new Error('Max contexts must be greater than 0');
    }
  }
}

export const memoryService = MemoryService.getInstance();
export default memoryService;