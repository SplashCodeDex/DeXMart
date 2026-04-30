import { useCallback, useEffect, useState } from "react";
import { useGateway } from "@/lib/gateway/gateway-hooks";

export interface AgentIdentity {
  id: string;
  name?: string;
  model?: string;
  displayName?: string;
  avatarUrl?: string;
  channel?: string;
  [key: string]: any;
}

export function useAgentIdentity(agentId: string) {
  const { rpc, status } = useGateway();
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdentity = useCallback(async () => {
    if (status !== "connected" || !rpc || !agentId) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await (rpc as any).call("agent.identity.get", { agentId });
      if (result.identity) {
        setIdentity(result.identity);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch agent identity";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [rpc, status, agentId]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const updateIdentity = async (updates: Partial<AgentIdentity>) => {
    if (!rpc || !agentId) return false;

    try {
      const result = await (rpc as any).call("agents.update", {
        id: agentId,
        ...updates,
      });
      if (result.ok) {
        if (result.agent) {
          setIdentity(result.agent);
        } else {
          await fetchIdentity();
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update agent identity:", err);
      return false;
    }
  };

  return {
    identity,
    isLoading,
    error,
    refresh: fetchIdentity,
    updateIdentity,
  };
}
