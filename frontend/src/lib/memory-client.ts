/**
 * memory-client.ts — React hook for the client-side hybrid memory worker.
 *
 * Provides a clean TypeScript interface to the memory-worker.ts WebWorker.
 * Handles:
 *   - Worker lifecycle (create, terminate)
 *   - Firestore proxy (worker sends Firestore requests to main thread)
 *   - Promise-based API (wraps postMessage/onmessage into async calls)
 *   - Model loading progress events
 *
 * Usage:
 *   const memory = useMemory(userId, firestore);
 *   await memory.remember('The user prefers dark mode');
 *   const results = await memory.search('user preferences');
 *
 * The worker runs in the background — no UI thread blocking.
 * The 45MB model is downloaded once and cached permanently by the browser.
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemorySearchResult {
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryStatus {
  initialized: boolean;
  modelLoaded: boolean;
  memoriesInDB: number;
  maxLocalItems: number;
  userId: string | null;
}

export interface MemoryInitProgress {
  stage: "loading_model" | "rehydrating";
  pct: number;
}

export interface FirestoreClient {
  collection(path: string): {
    add(data: Record<string, unknown>): Promise<{ id: string }>;
    orderBy(
      field: string,
      dir?: string,
    ): {
      limit(n: number): {
        get(): Promise<{ docs: Array<{ id: string; data(): Record<string, unknown> }> }>;
      };
    };
  };
}

export interface UseMemoryReturn {
  ready: boolean;
  loading: boolean;
  progress: MemoryInitProgress | null;
  error: string | null;
  remember(text: string, metadata?: Record<string, unknown>): Promise<void>;
  search(query: string, maxResults?: number): Promise<MemorySearchResult[]>;
  status(): Promise<MemoryStatus>;
  clear(): Promise<void>;
}

// ── Worker Client ─────────────────────────────────────────────────────────────

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  isProgress?: boolean;
  onProgress?: (p: MemoryInitProgress) => void;
};

import { z } from "zod";

export const WorkerResponseSchema = z.object({
  type: z.enum(["result", "error", "progress", "firestore:response"]),
  id: z.string().optional(),
  payload: z.unknown(),
});
export type WorkerResponse = z.infer<typeof WorkerResponseSchema>;

class MemoryWorkerClient {
  private worker: Worker;
  private pending = new Map<string, PendingRequest>();
  private msgCounter = 0;
  private firestoreClient: FirestoreClient;
  private userId: string;

  constructor(worker: Worker, firestoreClient: FirestoreClient, userId: string) {
    this.worker = worker;
    this.firestoreClient = firestoreClient;
    this.userId = userId;
    this.worker.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(rawEvent: MessageEvent): void {
    let eventData: WorkerResponse;
    try {
      eventData = WorkerResponseSchema.parse(rawEvent.data);
    } catch (err) {
      console.error("[MemoryWorkerClient] Invalid worker response:", err);
      return;
    }

    const { type, id, payload } = eventData;

    // Handle Firestore proxy requests from worker
    if (id?.startsWith("firestore:write:")) {
      const requestId = id.replace("firestore:write:", "");
      const { collection: path, data } = payload as {
        collection: string;
        data: Record<string, unknown>;
      };
      this.firestoreClient
        .collection(path)
        .add(data)
        .then((ref) => {
          this.worker.postMessage({
            type: "firestore:response",
            id: "firestore:response",
            payload: { requestId, data: { id: ref.id } },
          });
        })
        .catch((err) => {
          this.worker.postMessage({
            type: "firestore:response",
            id: "firestore:response",
            payload: { requestId, error: String(err) },
          });
        });
      return;
    }

    if (id?.startsWith("firestore:read:")) {
      const requestId = id.replace("firestore:read:", "");
      const { collection: path, limit } = payload as { collection: string; limit: number };
      this.firestoreClient
        .collection(path)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get()
        .then((snapshot) => {
          this.worker.postMessage({
            type: "firestore:response",
            id: "firestore:response",
            payload: { requestId, data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) },
          });
        })
        .catch((err) => {
          this.worker.postMessage({
            type: "firestore:response",
            id: "firestore:response",
            payload: { requestId, error: String(err) },
          });
        });
      return;
    }

    if (!id) return;
    const pending = this.pending.get(id);
    if (!pending) return;

    if (type === "progress" && pending.onProgress) {
      pending.onProgress(payload as MemoryInitProgress);
      return; // Don't resolve — wait for 'result'
    }

    this.pending.delete(id);
    if (type === "error") {
      pending.reject(new Error(String(payload)));
    } else {
      pending.resolve(payload);
    }
  }

  private send<T>(
    type: string,
    payload: Record<string, unknown>,
    onProgress?: (p: MemoryInitProgress) => void,
  ): Promise<T> {
    const id = `msg-${++this.msgCounter}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
      this.worker.postMessage({ type, id, payload });
    });
  }

  async init(onProgress?: (p: MemoryInitProgress) => void): Promise<void> {
    await this.send("init", { userId: this.userId }, onProgress);
  }

  async remember(text: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.send("remember", { text, metadata: metadata ?? {} });
  }

  async search(query: string, maxResults = 5): Promise<MemorySearchResult[]> {
    const result = await this.send<{ results: MemorySearchResult[] }>("search", {
      query,
      maxResults,
    });
    return result.results;
  }

  async status(): Promise<MemoryStatus> {
    return this.send<MemoryStatus>("status", {});
  }

  async clear(): Promise<void> {
    await this.send("clear", {});
  }

  terminate(): void {
    this.worker.terminate();
  }
}

// ── React Hook ────────────────────────────────────────────────────────────────

/**
 * useMemory — React hook for client-side hybrid memory.
 *
 * Creates a WebWorker running memory-worker.ts for the given user.
 * The worker is created once per userId and terminated on unmount.
 *
 * @param userId      - The authenticated user's Firebase UID.
 * @param firestore   - Firestore client instance (for Firestore proxy).
 */
export function useMemory(
  userId: string | null | undefined,
  firestore: FirestoreClient | null | undefined,
): UseMemoryReturn {
  const clientRef = useRef<MemoryWorkerClient | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<MemoryInitProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !firestore) return;

    setLoading(true);
    setError(null);

    // Create worker — Next.js requires the Worker constructor with module type
    const worker = new Worker(new URL("./memory-worker.ts", import.meta.url), { type: "module" });
    const client = new MemoryWorkerClient(worker, firestore, userId);
    clientRef.current = client;

    client
      .init((p) => setProgress(p))
      .then(() => {
        setReady(true);
        setLoading(false);
        setProgress(null);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });

    return () => {
      client.terminate();
      clientRef.current = null;
      setReady(false);
    };
  }, [userId, firestore]);

  const remember = useCallback(async (text: string, metadata?: Record<string, unknown>) => {
    if (!clientRef.current) throw new Error("Memory worker not ready");
    return clientRef.current.remember(text, metadata);
  }, []);

  const search = useCallback(async (query: string, maxResults = 5) => {
    if (!clientRef.current) return [];
    return clientRef.current.search(query, maxResults);
  }, []);

  const status = useCallback(async () => {
    if (!clientRef.current) throw new Error("Memory worker not ready");
    return clientRef.current.status();
  }, []);

  const clear = useCallback(async () => {
    if (!clientRef.current) throw new Error("Memory worker not ready");
    return clientRef.current.clear();
  }, []);

  return { ready, loading, progress, error, remember, search, status, clear };
}
