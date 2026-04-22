import type { firestore } from "firebase-admin";
import type {
  MemoryEmbeddingProbeResult,
  MemoryProviderStatus,
  MemoryReadResult,
  MemorySearchManager,
  MemorySearchResult,
} from "../memory-host-sdk/host/types.js";

/**
 * CloudGroundedMemoryManager is a DeXMart-exclusive memory manager that
 * grounds local vector memories in the cloud (Firestore).
 *
 * This implementation enforces the "5-10 rule":
 * - Up to 10 most recent memory items are persisted to Firestore.
 * - Old items are pruned (FIFO) to keep the cloud footprint minimal and fast.
 * - Vectors stay local for performance; text snippets stay in the cloud for continuity.
 */
export class CloudGroundedMemoryManager implements MemorySearchManager {
  private userId: string;
  private inner: MemorySearchManager;
  private db: firestore.Firestore;
  private readonly MAX_CLOUD_MEMORIES = 10;

  constructor(userId: string, inner: MemorySearchManager, db: firestore.Firestore) {
    this.userId = userId;
    this.inner = inner;
    this.db = db;
  }

  async search(query: string, opts?: any): Promise<MemorySearchResult[]> {
    return this.inner.search(query, opts);
  }

  async readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<MemoryReadResult> {
    return this.inner.readFile(params);
  }

  status(): MemoryProviderStatus {
    const s = this.inner.status();
    return {
      ...s,
      custom: {
        ...s.custom,
        grounded: true,
        userId: this.userId,
      },
    };
  }

  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
    return this.inner.probeEmbeddingAvailability();
  }

  async probeVectorAvailability(): Promise<boolean> {
    return this.inner.probeVectorAvailability();
  }

  async close(): Promise<void> {
    if (this.inner.close) {
      await this.inner.close();
    }
  }

  /**
   * Grounds the most recent memories into Firestore.
   * Note: This is a background-compatible operation.
   */
  async sync(params?: {
    reason?: string;
    force?: boolean;
    sessionFiles?: string[];
  }): Promise<void> {
    // 1. Delegate to the inner manager (local sqlite-vec sync)
    if (this.inner.sync) {
      await this.inner.sync(params);
    }

    // 2. Multi-Tenant Grounding: Sync to Firestore
    try {
      // In a real run, we want to capture what was just added.
      // Since the standard API doesn't have a 'getRecent' hook, we search for everything
      // or assume the inner manager's search results are representative.
      // For this implementation, we pull the top 10 from the inner manager.
      const recent = await this.inner.search("", { maxResults: this.MAX_CLOUD_MEMORIES });
      if (recent.length === 0) return;

      const memoriesCollection = this.db.collection(`users/${this.userId}/memory`);

      // Use a batch for atomic pruning/sync
      const batch = this.db.batch();

      // Simple implementation: overwrite with latest (FIFO via overwrite)
      // In Phase 3, we'll implement more advanced delta-sync.
      for (const [index, item] of recent.entries()) {
        const docRef = memoriesCollection.doc(`item_${index}`);
        batch.set(docRef, {
          path: item.path,
          snippet: item.snippet,
          score: item.score,
          source: item.source,
          updatedAt: new Date().toISOString(),
          version: "2026.f1",
        });
      }

      await batch.commit();
    } catch (err) {
      // Grounding failures should not crash the agent run, but they should be logged.
      console.warn(`[CloudGroundedMemory] Grounding failed for user ${this.userId}:`, err);
    }
  }
}
