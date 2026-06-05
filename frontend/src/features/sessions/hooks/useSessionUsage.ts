"use client";
import { useCallback, useEffect, useState } from "react";
import { useGateway } from "@/lib/gateway/gateway-hooks";

export interface SessionUsage {
  totals: {
    input: number;
    output: number;
    totalTokens: number;
    totalCost: number;
  };
  aggregates: {
    byModel: Array<{
      provider: string;
      model: string;
      count: number;
      totals: {
        totalTokens: number;
        totalCost: number;
      };
    }>;
  };
}

export function useSessionUsage(sessionId: string | null) {
  const { rpc, status } = useGateway();
  const [usage, setUsage] = useState<SessionUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (status !== "connected" || !sessionId) return;

    setIsLoading(true);
    try {
      if (!rpc) throw new Error("RPC not available");
      const result = await rpc.call("sessions.usage", { key: sessionId });
      // sessions.usage returns { sessions: [ { usage: ... } ] } when key is provided
      const session = result.sessions[0];
      if (session) {
        setUsage(session.usage);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch usage data";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [rpc, status, sessionId]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    isLoading,
    error,
    refresh: fetchUsage,
  };
}
