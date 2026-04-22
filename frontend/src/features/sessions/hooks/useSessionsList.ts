import type { SessionsListParams } from "@openclaw/protocol";
import { useCallback, useEffect, useMemo } from "react";

import { useSessionsStore, type Session } from "../store";

import { useGateway } from "@/lib/gateway/gateway-hooks";

export function useSessionsList(params: SessionsListParams = {}): {
  sessions: Session[];
  filteredSessions: Session[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refresh: () => Promise<void>;
} {
  const { rpc, status } = useGateway();
  const { sessions, searchQuery, setSessions, setLoading, setError } = useSessionsStore();

  const paramsJson = JSON.stringify(params);

  const fetchSessions = useCallback(async () => {
    if (status !== "connected") return;

    setLoading(true);
    try {
      const result = await rpc.call("sessions.list", {
        ...JSON.parse(paramsJson),
        search: searchQuery || (JSON.parse(paramsJson) as SessionsListParams).search,
      });
      // result is { sessions: Session[] }
      setSessions(result.sessions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch sessions";
      setError(message);
    }
  }, [rpc, status, paramsJson, searchQuery, setSessions, setLoading, setError]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (status !== "connected") return;

    // Subscribe to session changes to refresh the list
    const unsubscribe = rpc.subscribe("sessions", () => {
      fetchSessions();
    });

    return () => {
      unsubscribe();
    };
  }, [rpc, status, fetchSessions]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.label?.toLowerCase().includes(query) ||
        s.displayName?.toLowerCase().includes(query) ||
        s.sessionId.toLowerCase().includes(query),
    );
  }, [sessions, searchQuery]);

  return {
    sessions,
    filteredSessions,
    isLoading: useSessionsStore((state) => state.isLoading),
    error: useSessionsStore((state) => state.error),
    searchQuery,
    setSearchQuery: useSessionsStore((state) => state.setSearchQuery),
    refresh: fetchSessions,
  };
}
