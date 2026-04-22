import { create } from "zustand";

export interface Session {
  sessionId: string;
  updatedAt: number;
  startedAt?: number;
  label?: string;
  displayName?: string;
  channel?: string;
  model?: string;
  status?: "running" | "done" | "failed" | "killed" | "timeout";
  totalTokens?: number;
  estimatedCostUsd?: number;
  messages?: any[]; // For now, any[] until I find the correct Message type
}

export interface Checkpoint {
  id: string;
  updatedAt: number;
  reason: "manual" | "auto" | "branch" | "restore";
  tokenCount: number;
  messageCount: number;
  label?: string;
}

interface SessionsState {
  sessions: Session[];
  selectedSession: Session | null;
  checkpoints: Checkpoint[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;

  // Actions
  setSessions: (sessions: Session[]) => void;
  setSelectedSession: (session: Session | null) => void;
  setCheckpoints: (checkpoints: Checkpoint[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  clearSessions: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  selectedSession: null,
  checkpoints: [],
  isLoading: false,
  error: null,
  searchQuery: "",

  setSessions: (sessions) => set({ sessions, isLoading: false, error: null }),
  setSelectedSession: (selectedSession) => set({ selectedSession, isLoading: false, error: null }),
  setCheckpoints: (checkpoints) => set({ checkpoints, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearSessions: () => set({ sessions: [], selectedSession: null, checkpoints: [], error: null, isLoading: false, searchQuery: "" }),
}));
