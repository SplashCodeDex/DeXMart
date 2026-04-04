'use client';

import { create } from 'zustand';

import type { MemoryItem, MemorySearchResult, MemoryInitProgress } from '../types';

interface MemoryStore {
  // Worker state
  ready: boolean;
  loading: boolean;
  progress: MemoryInitProgress | null;
  error: string | null;

  // Memory data
  recentMemories: MemoryItem[];
  searchResults: MemorySearchResult[];
  searchQuery: string;
  isSearching: boolean;

  // Actions
  setWorkerState: (state: {
    ready?: boolean;
    loading?: boolean;
    progress?: MemoryInitProgress | null;
    error?: string | null;
  }) => void;
  setRecentMemories: (items: MemoryItem[]) => void;
  setSearchResults: (results: MemorySearchResult[]) => void;
  setSearchQuery: (query: string) => void;
  setIsSearching: (isSearching: boolean) => void;
  clearSearch: () => void;
}

export const useMemoryStore = create<MemoryStore>((set) => ({
  ready: false,
  loading: false,
  progress: null,
  error: null,
  recentMemories: [],
  searchResults: [],
  searchQuery: '',
  isSearching: false,

  setWorkerState: (state) => set((prev) => ({ ...prev, ...state })),
  setRecentMemories: (items) => set({ recentMemories: items }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsSearching: (isSearching) => set({ isSearching }),
  clearSearch: () => set({ searchResults: [], searchQuery: '', isSearching: false }),
}));
