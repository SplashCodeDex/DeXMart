import { useCallback, useEffect } from "react";

import { useSessionsStore, type Checkpoint } from "../store";

import { useGateway } from "@/lib/gateway/gateway-hooks";


export function useCompaction(sessionId: string | null): {
  checkpoints: Checkpoint[];
  isLoading: boolean;
  error: string | null;
  restore: (checkpointId: string) => Promise<void>;
  branch: (checkpointId: string, label?: string) => Promise<string | undefined>;
  refresh: () => Promise<void>;
} {
  const { rpc, status } = useGateway();
  const { checkpoints, setCheckpoints, setLoading, setError } = useSessionsStore();

  const fetchCheckpoints = useCallback(async () => {
    if (status !== "connected" || !sessionId) return;

    setLoading(true);
    try {
      const result = await rpc.call("sessions.compaction.list", { key: sessionId });
      // upstream returns { checkpoints: Checkpoint[] }
      setCheckpoints(result.checkpoints);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch checkpoints";
      setError(message);
    }
  }, [rpc, status, sessionId, setCheckpoints, setLoading, setError]);

  useEffect(() => {
    fetchCheckpoints();
  }, [fetchCheckpoints]);

  const restore = useCallback(async (checkpointId: string) => {
    if (status !== "connected" || !sessionId) return;

    setLoading(true);
    try {
      await rpc.call("sessions.compaction.restore", { key: sessionId, checkpointId });
      await fetchCheckpoints();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to restore checkpoint";
      setError(message);
    }
  }, [rpc, status, sessionId, fetchCheckpoints, setLoading, setError]);

  const branch = useCallback(async (checkpointId: string, label?: string): Promise<string | undefined> => {
    if (status !== "connected" || !sessionId) return;

    setLoading(true);
    try {
      const result = await rpc.call("sessions.compaction.branch", {
        key: sessionId,
        checkpointId,
        label,
      });
      return result.sessionId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to branch from checkpoint";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [rpc, status, sessionId, setLoading, setError]);

  return {
    checkpoints,
    isLoading: useSessionsStore((state) => state.isLoading),
    error: useSessionsStore((state) => state.error),
    restore,
    branch,
    refresh: fetchCheckpoints,
  };
}
