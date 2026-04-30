import type { SessionsListParams } from "@openclaw/protocol";
import { useCallback, useEffect, useMemo } from "react";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import { useSessionsStore, type Session } from "../store";

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
  const { sessions, searchQuery, setSessions, updateSessionInList, setLoading, setError } =
    useSessionsStore();

  const paramsJson = JSON.stringify(params);

  const fetchSessions = useCallback(async () => {
    if (status !== "connected" || !rpc) return;

    setLoading(true);
    try {
      const result = await rpc.call("sessions.list", {
        ...JSON.parse(paramsJson),
        search: searchQuery || (JSON.parse(paramsJson) as SessionsListParams).search,
      });
      // result is { sessions: Session[] }
      setSessions((result.sessions || []) as Session[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch sessions";
      setError(message);
    }
  }, [rpc, status, paramsJson, searchQuery, setSessions, setLoading, setError]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (status !== "connected" || !rpc) return;

    // Subscribe to session changes to refresh the list
    rpc.call("sessions.subscribe", {}).catch(console.error);

    const unsubscribe = rpc.subscribe("sessions.changed", (payload) => {
      if (
        payload?.sessionId &&
        (payload.reason === "patch" ||
          payload.reason === "send" ||
          payload.reason === "steer" ||
          payload.phase === "message")
      ) {
        // Incremental update for simple changes
        updateSessionInList({
          ...payload,
          sessionId: payload.sessionId,
        });
      } else {
        // Full refresh for creates, deletes, etc.
        fetchSessions();
      }
    });

    return () => {
      unsubscribe();
      if (rpc) {
        rpc.call("sessions.unsubscribe", {}).catch(console.error);
      }
    };
  }, [rpc, status, fetchSessions, updateSessionInList]);

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
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
