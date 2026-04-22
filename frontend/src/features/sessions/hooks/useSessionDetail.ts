import { useCallback, useEffect } from "react";

import { useSessionsStore, type Session } from "../store";

import { useGateway } from "@/lib/gateway/gateway-hooks";


export function useSessionDetail(sessionId: string | null): {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { rpc, status } = useGateway();
  const { selectedSession, setSelectedSession, setLoading, setError } = useSessionsStore();

  const fetchSession = useCallback(async () => {
    if (status !== "connected" || !sessionId) return;

    setLoading(true);
    try {
      const result = await rpc.call("sessions.get", { key: sessionId });
      // upstream returns { session: Session }
      setSelectedSession(result.session);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch session detail";
      setError(message);
    }
  }, [rpc, status, sessionId, setSelectedSession, setLoading, setError]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (status !== "connected" || !sessionId) return;

    // Subscribe to session-specific updates
    const unsubscribe = rpc.subscribe(`session:${sessionId}`, (updatedSession: Session) => {
      setSelectedSession(updatedSession);
    });

    return () => {
      unsubscribe();
    };
  }, [rpc, status, sessionId, setSelectedSession]);

  return {
    session: selectedSession,
    isLoading: useSessionsStore((state) => state.isLoading),
    error: useSessionsStore((state) => state.error),
    refresh: fetchSession,
  };
}
