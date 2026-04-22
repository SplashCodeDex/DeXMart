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
  selectedSession: Session | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;

  // Actions
  setSessions: (sessions: Session[]) => void;
  setSelectedSession: (session: Session | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  clearSessions: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  selectedSession: null,
  isLoading: false,
  error: null,
  searchQuery: "",

  setSessions: (sessions) => set({ sessions, isLoading: false, error: null }),
  setSelectedSession: (selectedSession) => set({ selectedSession, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearSessions: () => set({ sessions: [], selectedSession: null, error: null, isLoading: false, searchQuery: "" }),
}));
