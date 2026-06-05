"use client";
import { useCallback, useEffect } from "react";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import { useSessionsStore, type Session } from "../store";

export function useSessionDetail(sessionId: string | null): {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  steer: (text: string) => Promise<void>;
} {
  const { rpc, status } = useGateway();
  const { selectedSession, setSelectedSession, appendMessageToSession, setLoading, setError } =
    useSessionsStore();

  const fetchSession = useCallback(async () => {
    if (status !== "connected" || !sessionId || !rpc) return;

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

  const steer = useCallback(
    async (text: string) => {
      if (status !== "connected" || !sessionId || !rpc) return;
      try {
        await (rpc as any).call("sessions.steer", { key: sessionId, text });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to steer session";
        setError(message);
      }
    },
    [rpc, status, sessionId, setError],
  );

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (status !== "connected" || !sessionId || !rpc) return;

    // Subscribe to session-specific updates
    rpc.call("sessions.messages.subscribe", { key: sessionId }).catch(console.error);

    const unsubMessage = rpc.subscribe("session.message", (payload) => {
      if (
        payload?.sessionKey &&
        (payload.sessionKey === sessionId || payload.sessionKey.endsWith(`:${sessionId}`))
      ) {
        if (payload.message && sessionId) {
          appendMessageToSession(sessionId, payload.message);
        } else {
          fetchSession();
        }
      }
    });

    const unsubChanged = rpc.subscribe("sessions.changed", (payload) => {
      if (
        payload?.sessionKey &&
        (payload.sessionKey === sessionId || payload.sessionKey.endsWith(`:${sessionId}`))
      ) {
        if (payload.session) {
          setSelectedSession(payload.session);
        } else if (payload.sessionId) {
          // If we have session metadata in payload but not the full session object,
          // we can partially update the selected session.
          setSelectedSession({
            ...selectedSession,
            ...payload,
          } as Session);
        } else {
          fetchSession();
        }
      }
    });

    return () => {
      unsubMessage();
      unsubChanged();
      if (sessionId && rpc) {
        rpc.call("sessions.messages.unsubscribe", { key: sessionId }).catch(console.error);
      }
    };
  }, [rpc, status, sessionId, setSelectedSession, fetchSession]);

  return {
    session: selectedSession,
    isLoading: useSessionsStore((state) => state.isLoading),
    error: useSessionsStore((state) => state.error),
    refresh: fetchSession,
    steer,
  };
}
