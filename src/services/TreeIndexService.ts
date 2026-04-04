import { db } from '../lib/firebase.js';
import { embeddingService } from './embeddingService.js';
import { geminiAI } from './geminiAI.js'; // For summarization
import logger from '../utils/logger.js';
import { Result } from '../types/index.js';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

export interface TreeNode {
  id: string;
  parentId: string | null;
  children: string[];
  content: string;
  summary: string;
  embedding: number[]; // Embedding of the SUMMARY
  depth: number;
  scopeId: string; // tenantId:channelId or global
  metadata: Record<string, any>;
  createdAt: Timestamp;
}

export class TreeIndexService {
  private static instance: TreeIndexService;

  private constructor() { }

  public static getInstance(): TreeIndexService {
    if (!TreeIndexService.instance) {
      TreeIndexService.instance = new TreeIndexService();
    }
    return TreeIndexService.instance;
  }

  /**
   * Create a new Root Node for a conversation or document
   */
  async createRoot(scopeId: string, content: string, metadata: any = {}): Promise<Result<TreeNode>> {
    return this.createNode(scopeId, null, content, 0, metadata);
  }

  /**
   * Add a child node to an existing parent
   */
  async addChild(scopeId: string, parentId: string, content: string, metadata: any = {}): Promise<Result<TreeNode>> {
    // 1. Verify parent exists
    const parentDoc = await db.collection('tree_nodes').doc(parentId).get();
    if (!parentDoc.exists) {
      return { success: false, error: new Error(`Parent node ${parentId} not found`) };
    }
    const parentData = parentDoc.data() as TreeNode;

    // 2. Create child
    const result = await this.createNode(scopeId, parentId, content, parentData.depth + 1, metadata);
    
    // 3. Update parent's children list
    if (result.success && result.data) {
      await db.collection('tree_nodes').doc(parentId).update({
        children: [...(parentData.children || []), result.data.id]
      });
    }

    return result;
  }

  /**
   * Core logic to create and index a node
   */
  private async createNode(scopeId: string, parentId: string | null, content: string, depth: number, metadata: any): Promise<Result<TreeNode>> {
    try {
      // 1. Generate Summary (The "Reasoning Key")
      // We summarize the content to create a dense semantic representation
      const summaryResult = await geminiAI.generateText(`Summarize this context in one dense sentence for retrieval:\n\n"${content}"`);
      const summary = summaryResult.success ? summaryResult.data : content.substring(0, 200);

      // 2. Generate Embedding from SUMMARY
      const embeddingResult = await embeddingService.generateEmbedding(summary);
      if (!embeddingResult.success || !embeddingResult.data) {
        throw new Error('Failed to generate embedding');
      }

      const nodeId = `node_${crypto.randomUUID()}`;
      const node: TreeNode = {
        id: nodeId,
        parentId,
        children: [],
        content,
        summary,
        embedding: embeddingResult.data,
        depth,
        scopeId,
        metadata,
        createdAt: Timestamp.now()
      };

      await db.collection('tree_nodes').doc(nodeId).set(node);
      logger.info(`[TreeIndex] Created node ${nodeId} (Depth: ${depth})`);

      return { success: true, data: node };
    } catch (error: any) {
      logger.error('TreeIndexService.createNode error:', error);
      return { success: false, error };
    }
  }

  /**
   * Recursive Tree Search (The "Reasoning Retrieval")
   * Finds the best matching path down the tree.
   */
  async searchTree(scopeId: string, query: string, similarityThreshold = 0.75): Promise<Result<TreeNode[]>> {
    try {
      // 1. Embed Query
      const queryResult = await embeddingService.generateEmbedding(query);
      if (!queryResult.success || !queryResult.data) throw new Error('Failed to embed query');
      const queryVec = queryResult.data;

      // 2. Fetch Roots (Depth 0)
      const rootsSnap = await db.collection('tree_nodes')
        .where('scopeId', '==', scopeId)
        .where('depth', '==', 0)
        .get();

      if (rootsSnap.empty) return { success: true, data: [] };

      // 3. Find best Root
      let bestNode: TreeNode | null = null;
      let maxSim = -1;

      for (const doc of rootsSnap.docs) {
        const node = doc.data() as TreeNode;
        const sim = this.cosineSimilarity(queryVec, node.embedding);
        if (sim > maxSim) {
          maxSim = sim;
          bestNode = node;
        }
      }

      if (!bestNode || maxSim < similarityThreshold) {
        return { success: true, data: [] };
      }

      // 4. Drill Down (Recursive)
      const path: TreeNode[] = [bestNode];
      let current = bestNode;

      while (current.children && current.children.length > 0) {
        // Fetch children
        // Note: In prod, use `whereIn` or parallel gets. For now, strict fetch.
        const childrenSnap = await db.collection('tree_nodes')
          .where('parentId', '==', current.id)
          .get();
        
        if (childrenSnap.empty) break;

        let bestChild: TreeNode | null = null;
        let bestChildSim = -1;

        for (const doc of childrenSnap.docs) {
          const child = doc.data() as TreeNode;
          const sim = this.cosineSimilarity(queryVec, child.embedding);
          if (sim > bestChildSim) {
            bestChildSim = sim;
            bestChild = child;
          }
        }

        // If best child is relevant enough, go deeper
        // We relax threshold slightly for children as they are more specific
        if (bestChild && bestChildSim > (similarityThreshold - 0.1)) {
          path.push(bestChild);
          current = bestChild;
        } else {
          break; // Stop drilling
        }
      }

      return { success: true, data: path };

    } catch (error: any) {
      logger.error('TreeIndexService.searchTree error:', error);
      return { success: false, error };
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
}

export const treeIndexService = TreeIndexService.getInstance();
export default treeIndexService;
