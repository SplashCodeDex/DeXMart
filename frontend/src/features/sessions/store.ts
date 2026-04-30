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
  updateSessionInList: (session: Partial<Session> & { sessionId: string }) => void;
  setSelectedSession: (session: Session | null) => void;
  appendMessageToSession: (sessionId: string, message: any) => void;
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

  updateSessionInList: (updatedSession) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.sessionId === updatedSession.sessionId ? { ...s, ...updatedSession } : s,
      ),
    })),

  setSelectedSession: (selectedSession) => set({ selectedSession, isLoading: false, error: null }),

  appendMessageToSession: (sessionId, message) =>
    set((state) => {
      if (state.selectedSession?.sessionId === sessionId) {
        const messages = [...(state.selectedSession.messages || []), message];
        return {
          selectedSession: {
            ...state.selectedSession,
            messages,
          },
        };
      }
      return state;
    }),

  setCheckpoints: (checkpoints) => set({ checkpoints, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearSessions: () =>
    set({
      sessions: [],
      selectedSession: null,
      checkpoints: [],
      error: null,
      isLoading: false,
      searchQuery: "",
    }),
}));
