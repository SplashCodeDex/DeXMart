import { create } from "zustand";

export interface Session {
  sessionId: string;
  updatedAt: number;
  label?: string;
  displayName?: string;
  channel?: string;
  model?: string;
  status?: "running" | "done" | "failed" | "killed" | "timeout";
  totalTokens?: number;
  estimatedCostUsd?: number;
}

interface SessionsState {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;

  // Actions
  setSessions: (sessions: Session[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  clearSessions: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  isLoading: false,
  error: null,
  searchQuery: "",

  setSessions: (sessions) => set({ sessions, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearSessions: () => set({ sessions: [], error: null, isLoading: false, searchQuery: "" }),
}));
