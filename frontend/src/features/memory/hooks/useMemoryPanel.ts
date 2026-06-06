"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/features/auth";
import { useMemory } from "@/lib/memory-client";
import { useMemoryStore } from "../stores/useMemoryStore";
import type { MemoryItem } from "../types";

/**
 * useMemoryPanel
 *
 * Orchestrates the memory worker lifecycle and exposes typed actions
 * for the MemoryPanel, MemorySearchBar, and MemoryStatusBadge components.
 *
 * Responsibilities:
 *   - Initialises the memory worker for the current user
 *   - Syncs worker state to useMemoryStore
 *   - Exposes search, remember, and clear actions
 *   - Optimistically updates recentMemories on remember()
 */
function useMemoryPanel() {
  const { user } = useAuth();

  // Firestore client: lazy-imported client-side only to avoid SSR issues
  const firestoreRef = useRef<import("@/lib/memory-client").FirestoreClient | null>(null);
  useEffect(() => {
    import("@/lib/firebase/client").then(({ getClientFirestore }) => {
      firestoreRef.current =
        getClientFirestore() as unknown as import("@/lib/memory-client").FirestoreClient;
    });
  }, []);

  const memory = useMemory(user?.id ?? null, firestoreRef.current);

  // Read reactive store state directly — not via getState() snapshot
  const storeState = useMemoryStore();
  const {
    recentMemories,
    setWorkerState,
    setRecentMemories,
    setSearchResults,
    setSearchQuery,
    setIsSearching,
    clearSearch,
  } = storeState;

  // Sync worker state → Zustand store whenever it changes
  useEffect(() => {
    setWorkerState({
      ready: memory.ready,
      loading: memory.loading,
      progress: memory.progress,
      error: memory.error,
    });
  }, [memory.ready, memory.loading, memory.progress, memory.error, setWorkerState]);

  // On ready: confirm status (counts only, not text — worker stores vectors locally)
  const memoryStatus = memory.status;
  useEffect(() => {
    if (!memory.ready) return;
    memoryStatus().catch(() => {}); // non-blocking, no state update needed for counts
  }, [memory.ready, memoryStatus]);

  const search = useCallback(
    async (query: string): Promise<void> => {
      if (!memory.ready || !query.trim()) return;
      setSearchQuery(query);
      setIsSearching(true);
      try {
        const results = await memory.search(query, 5);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [memory, setSearchQuery, setIsSearching, setSearchResults],
  );

  const remember = useCallback(
    async (text: string, metadata?: Record<string, unknown>): Promise<void> => {
      if (!memory.ready || !text.trim()) return;
      await memory.remember(text, metadata);
      // Optimistically prepend to recentMemories — store takes an array, not a setter
      const newItem: MemoryItem = {
        id: `local-${Date.now()}`,
        text,
        metadata: metadata as MemoryItem["metadata"],
        createdAt: new Date().toISOString(),
      };
      setRecentMemories([newItem, ...recentMemories].slice(0, 10));
    },
    [memory, recentMemories, setRecentMemories],
  );

  const clear = useCallback(async (): Promise<void> => {
    if (!memory.ready) return;
    await memory.clear();
    setRecentMemories([]);
    clearSearch();
  }, [memory, setRecentMemories, clearSearch]);

  return {
    // Reactive store state
    recentMemories: storeState.recentMemories,
    searchResults: storeState.searchResults,
    searchQuery: storeState.searchQuery,
    isSearching: storeState.isSearching,
    // Worker state (directly from worker, not store — avoids one render lag)
    ready: memory.ready,
    loading: memory.loading,
    progress: memory.progress,
    error: memory.error,
    // Actions
    search,
    remember,
    clear,
    clearSearch,
  };
}
